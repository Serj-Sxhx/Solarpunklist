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
