/**
 * Fetches a headshot/avatar image for a person using Exa search.
 * Similar pattern to image-fetcher.ts but tuned for portraits.
 */

function isValidPersonImageUrl(url: string): boolean {
  if (!url || url.length < 10) return false;
  try {
    new URL(url);
  } catch {
    return false;
  }
  const lower = url.toLowerCase();
  const reject = [
    "favicon", "spacer", "pixel", "tracking", "1x1", "blank",
    "loading.gif", "gravatar.com", "wp-content/plugins", "rss_icon",
    "badge", "shield", "gettyimages.com", "logo", "icon-phone",
  ];
  if (reject.some((p) => lower.includes(p))) return false;
  if (lower.endsWith(".svg") || lower.endsWith(".ico") || lower.endsWith(".gif")) return false;
  return true;
}

async function verifyPersonImage(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
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
    // Accept smaller images for headshots (min 3KB)
    if (contentLength && parseInt(contentLength) < 3000) return false;
    return true;
  } catch {
    return false;
  }
}

export async function fetchPersonAvatar(
  personName: string,
  website?: string | null
): Promise<string | null> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) return null;

  const queries = [
    `"${personName}" headshot portrait photo`,
    `${personName} profile photo`,
  ];
  if (website) queries.unshift(`${personName} site:${new URL(website).hostname}`);

  for (const query of queries) {
    try {
      const body: Record<string, unknown> = {
        query,
        type: "neural",
        numResults: 8,
        contents: {
          text: false,
          extras: { imageLinks: 5 },
        },
      };

      const response = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) continue;
      const data = await response.json();
      const results = data.results || [];

      const candidates: string[] = [];
      for (const result of results) {
        if (result.image && isValidPersonImageUrl(result.image)) {
          candidates.push(result.image);
        }
        if (result.extras?.imageLinks) {
          for (const img of result.extras.imageLinks) {
            if (isValidPersonImageUrl(img)) candidates.push(img);
          }
        }
      }

      for (const url of candidates.slice(0, 5)) {
        if (await verifyPersonImage(url)) {
          return url;
        }
      }
    } catch (err) {
      console.error(`[person-avatar] Search error for "${personName}":`, err);
    }
  }

  return null;
}
