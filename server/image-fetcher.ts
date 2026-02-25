import { storage } from "./storage";

async function searchExaForImages(query: string, includeDomains?: string[]): Promise<{ imageUrl: string; sourceUrl: string; altText: string }[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) return [];

  try {
    const body: Record<string, unknown> = {
      query,
      type: "neural",
      numResults: 10,
      contents: {
        text: false,
        extras: {
          imageLinks: 5,
        },
      },
    };

    if (includeDomains && includeDomains.length > 0) {
      body.includeDomains = includeDomains;
    }

    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) return [];
    const data = await response.json();
    const results = data.results || [];

    const images: { imageUrl: string; sourceUrl: string; altText: string }[] = [];
    const seenUrls = new Set<string>();

    for (const result of results) {
      if (result.image && !seenUrls.has(result.image)) {
        if (isValidImageUrl(result.image)) {
          seenUrls.add(result.image);
          images.push({
            imageUrl: result.image,
            sourceUrl: result.url,
            altText: result.title || "",
          });
        }
      }

      if (result.extras?.imageLinks) {
        for (const imgUrl of result.extras.imageLinks) {
          if (!seenUrls.has(imgUrl) && isValidImageUrl(imgUrl)) {
            seenUrls.add(imgUrl);
            images.push({
              imageUrl: imgUrl,
              sourceUrl: result.url,
              altText: result.title || "",
            });
          }
        }
      }
    }

    return images;
  } catch (error) {
    console.error("Image search error:", error);
    return [];
  }
}

function isValidImageUrl(url: string): boolean {
  if (!url || url.length < 10) return false;

  try {
    new URL(url);
  } catch {
    return false;
  }

  const lower = url.toLowerCase();

  const rejectPatterns = [
    "favicon", "spacer", "pixel", "tracking", "analytics",
    "1x1", "blank.jpg", "blank.png", "loading.gif", "loading.png",
    "gravatar.com", "wp-content/plugins", "buddyicon",
    "spaceout", "spaceball", "privacyoptions", "rss_icon",
    "wikipedia-logo", "cross.png", "icon-phone", "icon-envelope",
    "gettyimages.com",
  ];
  if (rejectPatterns.some((p) => lower.includes(p))) return false;

  if (lower.includes("logo")) return false;

  if (lower.endsWith(".svg") || lower.endsWith(".ico") || lower.endsWith(".gif")) return false;

  const filename = lower.split("/").pop() || "";
  if (filename.includes("icon") && !filename.includes("section")) return false;

  if (lower.includes("badge") && lower.includes("shield")) return false;

  return true;
}

async function verifyImageUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: { "User-Agent": "SolarpunkList/1.0" },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!response.ok) return false;

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return false;
    if (contentType.includes("gif") || contentType.includes("svg")) return false;

    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength) < 5000) return false;

    return true;
  } catch {
    return false;
  }
}

function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}

export async function fetchAndStoreImages(
  communityId: string,
  communityName: string,
  websiteUrl: string | null
): Promise<number> {
  console.log(`  [images] Fetching images for ${communityName}...`);

  const existingImages = await storage.getImagesByCommunityId(communityId);
  const existingUrls = new Set(existingImages.map((img) => img.imageUrl));

  const allImages: { imageUrl: string; sourceUrl: string; altText: string }[] = [];

  if (websiteUrl) {
    const domain = extractDomain(websiteUrl);
    if (domain) {
      const siteImages = await searchExaForImages(
        `${communityName} community`,
        [domain]
      );
      for (const img of siteImages) {
        if (!existingUrls.has(img.imageUrl) && !allImages.some((a) => a.imageUrl === img.imageUrl)) {
          allImages.push(img);
        }
      }
    }
  }

  if (allImages.length < 6) {
    const searchQueries = [
      `"${communityName}" ecovillage community photos`,
      `${communityName} sustainable community`,
    ];

    for (const query of searchQueries) {
      const images = await searchExaForImages(query);
      for (const img of images) {
        if (!existingUrls.has(img.imageUrl) && !allImages.some((a) => a.imageUrl === img.imageUrl)) {
          allImages.push(img);
        }
      }
      if (allImages.length >= 6) break;
    }
  }

  if (allImages.length === 0) {
    console.log(`  [images] No new images found for ${communityName}`);
    return 0;
  }

  const candidates = allImages.slice(0, 12);
  const verifiedImages: typeof allImages = [];
  for (const img of candidates) {
    if (verifiedImages.length >= 8) break;
    const valid = await verifyImageUrl(img.imageUrl);
    if (valid) {
      verifiedImages.push(img);
    }
  }

  if (verifiedImages.length === 0) {
    console.log(`  [images] No verified images for ${communityName}`);
    return 0;
  }

  const imagesToStore = verifiedImages;
  const startOrder = existingImages.length;

  if (existingImages.length === 0) {
    await storage.updateCommunity(communityId, {
      heroImageUrl: imagesToStore[0].imageUrl,
    });
  }

  await storage.addImages(
    communityId,
    imagesToStore.map((img, i) => ({
      imageUrl: img.imageUrl,
      altText: img.altText || `${communityName} photo`,
      sourceUrl: img.sourceUrl,
      isHero: existingImages.length === 0 && i === 0,
      sortOrder: startOrder + i,
    }))
  );

  console.log(`  [images] Stored ${imagesToStore.length} images for ${communityName}`);
  return imagesToStore.length;
}

export async function validateHeroImage(url: string): Promise<{ valid: boolean; reason?: string }> {
  if (!url || url.length < 10) return { valid: false, reason: "no_url" };

  if (url.startsWith("/images/communities/")) return { valid: true };

  if (url.startsWith("http://")) {
    const httpsUrl = url.replace("http://", "https://");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(httpsUrl, {
        method: "HEAD",
        signal: controller.signal,
        headers: { "User-Agent": "SolarpunkList/1.0" },
        redirect: "follow",
      });
      clearTimeout(timeout);
      if (!resp.ok) return { valid: false, reason: "http_only_broken_on_https" };
    } catch {
      return { valid: false, reason: "http_only_no_https" };
    }
  }

  const lower = url.toLowerCase();
  if (lower.includes("logo") || lower.includes("favicon") || lower.includes("icon")) {
    return { valid: false, reason: "likely_logo" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "SolarpunkList/1.0", "Range": "bytes=0-65535" },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!response.ok) return { valid: false, reason: "broken" };

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return { valid: false, reason: "not_image" };
    if (contentType.includes("svg")) return { valid: false, reason: "svg" };
    if (contentType.includes("gif")) return { valid: false, reason: "gif" };

    const contentLength = response.headers.get("content-length");
    const size = contentLength ? parseInt(contentLength) : 0;

    if (size > 0 && size < 10000) return { valid: false, reason: "too_small" };

    if (contentType.includes("png")) {
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      if (bytes.length >= 26) {
        const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
        const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
        const colorType = bytes[25];

        if (width < 300 || height < 200) return { valid: false, reason: "too_small_dimensions" };

        const isTransparent = colorType === 4 || colorType === 6;
        if (isTransparent && size < 50000) {
          return { valid: false, reason: "transparent_png_likely_logo" };
        }
        if (isTransparent && width > 0 && height > 0) {
          const ratio = Math.max(width, height) / Math.min(width, height);
          if (ratio < 1.3 && size < 100000) {
            return { valid: false, reason: "transparent_png_likely_logo" };
          }
        }
      }
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: "broken" };
  }
}

export async function repairHeroImage(
  communityId: string,
  communityName: string,
  websiteUrl: string | null,
  slug: string,
  currentUrl?: string
): Promise<{ action: string; newUrl?: string }> {
  console.log(`  [hero-repair] Attempting to find replacement for ${communityName}...`);

  if (currentUrl?.startsWith("http://")) {
    const httpsUrl = currentUrl.replace("http://", "https://");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(httpsUrl, {
        method: "HEAD",
        signal: controller.signal,
        headers: { "User-Agent": "SolarpunkList/1.0" },
        redirect: "follow",
      });
      clearTimeout(timeout);
      if (resp.ok) {
        await storage.updateCommunity(communityId, { heroImageUrl: httpsUrl });
        console.log(`  [hero-repair] Upgraded to HTTPS: ${httpsUrl}`);
        return { action: "upgraded_to_https", newUrl: httpsUrl };
      }
    } catch {}
  }

  if (websiteUrl) {
    const domain = extractDomain(websiteUrl);
    if (domain) {
      const siteImages = await searchExaForImages(`${communityName} community photos landscape`, [domain]);
      for (const img of siteImages) {
        if (!isValidImageUrl(img.imageUrl)) continue;
        const validation = await validateHeroImage(img.imageUrl);
        if (validation.valid) {
          await storage.updateCommunity(communityId, { heroImageUrl: img.imageUrl });
          console.log(`  [hero-repair] Found replacement from site: ${img.imageUrl}`);
          return { action: "replaced_from_site", newUrl: img.imageUrl };
        }
      }
    }
  }

  const webImages = await searchExaForImages(`"${communityName}" ecovillage community photos`);
  for (const img of webImages) {
    if (!isValidImageUrl(img.imageUrl)) continue;
    const validation = await validateHeroImage(img.imageUrl);
    if (validation.valid) {
      await storage.updateCommunity(communityId, { heroImageUrl: img.imageUrl });
      console.log(`  [hero-repair] Found replacement from web: ${img.imageUrl}`);
      return { action: "replaced_from_web", newUrl: img.imageUrl };
    }
  }

  const fallbackPath = `/images/communities/${slug}.png`;
  await storage.updateCommunity(communityId, { heroImageUrl: fallbackPath });
  console.log(`  [hero-repair] Set fallback path for ${communityName}: ${fallbackPath}`);
  return { action: "set_fallback", newUrl: fallbackPath };
}

export async function auditAndFixHeroImages(): Promise<{
  audited: number;
  fixed: number;
  alreadyGood: number;
  details: { name: string; slug: string; issue: string; action: string; newUrl?: string }[];
}> {
  const allCommunities = await storage.getCommunities();
  const details: { name: string; slug: string; issue: string; action: string; newUrl?: string }[] = [];
  let fixed = 0;
  let alreadyGood = 0;

  console.log(`[hero-audit] Auditing ${allCommunities.length} communities...`);

  for (const community of allCommunities) {
    const heroUrl = community.heroImageUrl;
    const validation = await validateHeroImage(heroUrl || "");

    if (validation.valid) {
      alreadyGood++;
      continue;
    }

    const issue = validation.reason || "unknown";
    console.log(`  [hero-audit] ${community.name}: ${issue} (${heroUrl?.substring(0, 80)})`);

    try {
      const result = await repairHeroImage(community.id, community.name, community.websiteUrl, community.slug, heroUrl || undefined);
      details.push({
        name: community.name,
        slug: community.slug,
        issue,
        action: result.action,
        newUrl: result.newUrl,
      });
      fixed++;
    } catch (err: any) {
      details.push({
        name: community.name,
        slug: community.slug,
        issue,
        action: "failed",
      });
    }
  }

  console.log(`[hero-audit] Complete: ${alreadyGood} good, ${fixed} fixed out of ${allCommunities.length}`);

  return { audited: allCommunities.length, fixed, alreadyGood, details };
}

export async function backfillAllImages(): Promise<{
  communitiesProcessed: number;
  totalImagesAdded: number;
  errors: string[];
}> {
  const allCommunities = await storage.getCommunities();
  const errors: string[] = [];
  let totalImagesAdded = 0;
  let communitiesProcessed = 0;

  const MIN_IMAGES = 3;
  const needsImages = allCommunities.filter(
    (c) => c.images.length < MIN_IMAGES
  );

  console.log(`[images] Backfilling images for ${needsImages.length} communities (< ${MIN_IMAGES} images)...`);

  for (const community of needsImages) {
    try {
      const count = await fetchAndStoreImages(
        community.id,
        community.name,
        community.websiteUrl
      );
      totalImagesAdded += count;
      communitiesProcessed++;
    } catch (error) {
      errors.push(`Failed for ${community.name}: ${error}`);
    }
  }

  console.log(`[images] Backfill complete: ${communitiesProcessed} communities, ${totalImagesAdded} images added`);

  return { communitiesProcessed, totalImagesAdded, errors };
}
