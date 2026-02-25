import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/communities", async (_req, res) => {
    try {
      const communities = await storage.getCommunities();
      res.json(communities);
    } catch (error) {
      console.error("Error fetching communities:", error);
      res.status(500).json({ error: "Failed to fetch communities" });
    }
  });

  app.get("/api/communities/:slug", async (req, res) => {
    try {
      const community = await storage.getCommunityBySlug(req.params.slug);
      if (!community) {
        return res.status(404).json({ error: "Community not found" });
      }
      res.json(community);
    } catch (error) {
      console.error("Error fetching community:", error);
      res.status(500).json({ error: "Failed to fetch community" });
    }
  });

  app.get("/api/stats", async (_req, res) => {
    try {
      const count = await storage.getCommunityCount();
      res.json({ totalCommunities: count });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.post("/api/admin/discover", async (_req, res) => {
    try {
      const { runDiscovery } = await import("./discovery");
      const result = await runDiscovery();
      res.json(result);
    } catch (error) {
      console.error("Discovery error:", error);
      res.status(500).json({ error: "Discovery failed" });
    }
  });

  app.post("/api/admin/refresh", async (_req, res) => {
    try {
      const { runRefresh } = await import("./refresh");
      const result = await runRefresh();
      res.json(result);
    } catch (error) {
      console.error("Refresh error:", error);
      res.status(500).json({ error: "Refresh failed" });
    }
  });

  app.post("/api/admin/backfill-images", async (_req, res) => {
    try {
      const { backfillAllImages } = await import("./image-fetcher");
      const result = await backfillAllImages();
      res.json(result);
    } catch (error) {
      console.error("Image backfill error:", error);
      res.status(500).json({ error: "Image backfill failed" });
    }
  });

  app.post("/api/subscribe", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({ error: "Valid email is required" });
      }
      const subscriber = await storage.addEmailSubscriber(email.trim().toLowerCase());
      res.json({ success: true, subscriber });
    } catch (error) {
      console.error("Subscribe error:", error);
      res.status(500).json({ error: "Failed to subscribe" });
    }
  });

  app.post("/api/submit-community", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "A URL is required" });
      }

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          return res.status(400).json({ error: "URL must start with http:// or https://" });
        }
      } catch {
        return res.status(400).json({ error: "Please enter a valid URL (e.g. https://example.com)" });
      }

      const blockedHostnames = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]", "metadata.google.internal", "169.254.169.254"];
      const hostname = parsedUrl.hostname.toLowerCase();
      if (
        blockedHostnames.includes(hostname) ||
        hostname.endsWith(".local") ||
        hostname.endsWith(".internal") ||
        /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(hostname)
      ) {
        return res.status(400).json({ error: "This URL cannot be used. Please provide a public website URL." });
      }

      const { researchFromUrl } = await import("./discovery");
      const result = await researchFromUrl(parsedUrl.href);
      res.json({ success: true, slug: result.slug, name: result.name });
    } catch (error: any) {
      console.error("Submit community error:", error);
      const message = error?.message || "Something went wrong while researching this community.";
      res.status(400).json({ error: message });
    }
  });

  app.post("/api/track-visit", async (req, res) => {
    try {
      const { path } = req.body;
      if (!path || typeof path !== "string" || path.length > 500) {
        return res.status(400).json({ error: "Valid path is required" });
      }
      await storage.trackVisit(path.slice(0, 500));
      res.json({ success: true });
    } catch (error) {
      console.error("Track visit error:", error);
      res.status(500).json({ error: "Failed to track visit" });
    }
  });

  app.get("/api/visit-stats", async (_req, res) => {
    try {
      const stats = await storage.getVisitStats();
      res.json(stats);
    } catch (error) {
      console.error("Visit stats error:", error);
      res.status(500).json({ error: "Failed to fetch visit stats" });
    }
  });

  app.post("/api/admin/scrape-directory", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "A directory URL is required" });
      }

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          return res.status(400).json({ error: "URL must start with http:// or https://" });
        }
      } catch {
        return res.status(400).json({ error: "Please enter a valid URL" });
      }

      const blockedHostnames = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]", "metadata.google.internal", "169.254.169.254"];
      const hostname = parsedUrl.hostname.toLowerCase();
      if (
        blockedHostnames.includes(hostname) ||
        hostname.endsWith(".local") ||
        hostname.endsWith(".internal") ||
        /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(hostname)
      ) {
        return res.status(400).json({ error: "This URL cannot be used. Please provide a public website URL." });
      }

      const apiKey = process.env.EXA_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "EXA_API_KEY not configured" });
      }

      let pageContent = "";
      try {
        const response = await fetch("https://api.exa.ai/contents", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({
            urls: [parsedUrl.href],
            text: { maxCharacters: 20000 },
          }),
        });
        if (response.ok) {
          const data = await response.json();
          const result = data.results?.[0];
          if (result) {
            pageContent = result.text || "";
          }
        }
      } catch {}

      if (!pageContent || pageContent.length < 50) {
        try {
          const resp = await fetch(parsedUrl.href, {
            headers: { "User-Agent": "SolarpunkListBot/1.0" },
            signal: AbortSignal.timeout(15000),
          });
          const html = await resp.text();
          pageContent = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").substring(0, 20000);
        } catch {
          return res.status(400).json({ error: "Could not fetch content from this URL." });
        }
      }

      if (pageContent.length < 50) {
        return res.status(400).json({ error: "Not enough content found at this URL to extract a directory." });
      }

      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const anthropic = new Anthropic({
        apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
      });

      const llmResp = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: `You are analyzing a web page that contains a directory or list of intentional communities, ecovillages, regenerative land projects, or similar solarpunk communities.

Extract every community/project listed on the page. For each one, provide:
- name: The community or project name
- url: The URL to their website or profile page (if available, otherwise null)
- location: Their location if mentioned (otherwise null)

PAGE CONTENT:
${pageContent}

Return a JSON array of objects: [{"name": "...", "url": "...", "location": "..."}]
If you cannot find any communities listed, return an empty array [].
Return ONLY valid JSON, no explanation.`,
          },
        ],
      });

      const llmText = llmResp.content[0];
      if (llmText.type !== "text") {
        return res.status(500).json({ error: "Failed to parse directory content" });
      }

      let entries: { name: string; url: string | null; location: string | null }[] = [];
      try {
        const match = llmText.text.match(/\[[\s\S]*\]/);
        entries = JSON.parse(match?.[0] || "[]");
      } catch {
        return res.status(500).json({ error: "Failed to parse LLM response into community list" });
      }

      if (!entries.length) {
        return res.status(400).json({ error: "No communities found on this directory page." });
      }

      const existingSlugs = await storage.getAllPublishedSlugs();
      const existingCommunities = await storage.getCommunities();
      const existingNames = new Set(existingCommunities.map(c => c.name.toLowerCase().trim()));

      const seenNames = new Set<string>();
      const seenUrls = new Set<string>();

      const annotatedEntries = entries.map((entry) => {
        const normalizedName = entry.name.toLowerCase().trim();
        const normalizedUrl = entry.url?.toLowerCase().trim().replace(/\/+$/, "") || "";

        const isDuplicateInList = seenNames.has(normalizedName) ||
          (normalizedUrl && seenUrls.has(normalizedUrl));

        seenNames.add(normalizedName);
        if (normalizedUrl) seenUrls.add(normalizedUrl);

        const slug = entry.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        const isDuplicateExisting = existingSlugs.includes(slug) ||
          existingNames.has(normalizedName);

        return {
          name: entry.name,
          url: entry.url,
          location: entry.location,
          isDuplicateInList,
          isDuplicateExisting,
        };
      });

      res.json({ entries: annotatedEntries });
    } catch (error: any) {
      console.error("Scrape directory error:", error);
      res.status(500).json({ error: error?.message || "Failed to scrape directory" });
    }
  });

  app.post("/api/admin/bulk-research", async (req, res) => {
    try {
      const { entries } = req.body;
      if (!entries || !Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ error: "Entries array is required" });
      }

      const { researchFromUrl } = await import("./discovery");
      const results: { name: string; url: string; status: string; slug?: string; error?: string }[] = [];

      for (const entry of entries) {
        const entryUrl = entry.url || `https://www.google.com/search?q=${encodeURIComponent(entry.name + " intentional community ecovillage")}`;
        try {
          const result = await researchFromUrl(entryUrl);
          results.push({
            name: entry.name,
            url: entryUrl,
            status: "success",
            slug: result.slug,
          });
        } catch (err: any) {
          results.push({
            name: entry.name,
            url: entryUrl,
            status: "error",
            error: err?.message || "Research failed",
          });
        }
      }

      res.json({ results });
    } catch (error: any) {
      console.error("Bulk research error:", error);
      res.status(500).json({ error: error?.message || "Bulk research failed" });
    }
  });

  app.post("/api/admin/seed", async (_req, res) => {
    try {
      const { seedCommunities } = await import("./seed");
      await seedCommunities();
      res.json({ success: true });
    } catch (error) {
      console.error("Seed error:", error);
      res.status(500).json({ error: "Seeding failed" });
    }
  });

  return httpServer;
}
