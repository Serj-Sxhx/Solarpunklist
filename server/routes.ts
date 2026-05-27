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
      const { unsubscribeToken: _tok, ...safeSubscriber } = await storage.addEmailSubscriber(email.trim().toLowerCase());
      res.json({ success: true, subscriber: safeSubscriber });
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
      const exaApiKey = process.env.EXA_API_KEY;
      const results: { name: string; url: string; status: string; slug?: string; error?: string }[] = [];

      for (const entry of entries) {
        let entryUrl = entry.url;

        if (!entryUrl || entryUrl.includes("google.com/search")) {
          if (exaApiKey) {
            try {
              const searchResp = await fetch("https://api.exa.ai/search", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-api-key": exaApiKey,
                },
                body: JSON.stringify({
                  query: `${entry.name} intentional community ecovillage official website`,
                  numResults: 1,
                  type: "neural",
                }),
              });
              if (searchResp.ok) {
                const searchData = await searchResp.json();
                const topResult = searchData.results?.[0];
                if (topResult?.url) {
                  entryUrl = topResult.url;
                  console.log(`[bulk-research] Found URL for "${entry.name}": ${entryUrl}`);
                }
              }
            } catch (searchErr) {
              console.error(`[bulk-research] Exa search failed for "${entry.name}":`, searchErr);
            }
          }
        }

        if (!entryUrl) {
          results.push({
            name: entry.name,
            url: "",
            status: "error",
            error: "Could not find a website for this community",
          });
          continue;
        }

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

  app.post("/api/admin/audit-hero-images", async (_req, res) => {
    try {
      const { auditAndFixHeroImages } = await import("./image-fetcher");
      const result = await auditAndFixHeroImages();
      res.json(result);
    } catch (error: any) {
      console.error("Hero audit error:", error);
      res.status(500).json({ error: error?.message || "Hero image audit failed" });
    }
  });

  app.get("/api/admin/export-all", async (_req, res) => {
    try {
      const allCommunities = await storage.getCommunities();
      res.json({ communities: allCommunities });
    } catch (error: any) {
      console.error("Export error:", error);
      res.status(500).json({ error: "Export failed" });
    }
  });

  app.post("/api/admin/import-communities", async (req, res) => {
    try {
      const { communities: incoming } = req.body;
      if (!incoming || !Array.isArray(incoming)) {
        return res.status(400).json({ error: "communities array is required" });
      }

      const existingSlugs = new Set(await storage.getAllPublishedSlugs());
      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const c of incoming) {
        if (existingSlugs.has(c.slug)) {
          skipped++;
          continue;
        }

        try {
          const community = await storage.createCommunity({
            name: c.name,
            slug: c.slug,
            tagline: c.tagline,
            overview: c.overview,
            locationCountry: c.locationCountry,
            locationRegion: c.locationRegion,
            locationLat: c.locationLat,
            locationLng: c.locationLng,
            stage: c.stage,
            population: c.population,
            foundedYear: c.foundedYear,
            websiteUrl: c.websiteUrl,
            heroImageUrl: c.heroImageUrl,
            solarpunkScore: c.solarpunkScore,
            scoreEnergy: c.scoreEnergy,
            scoreLand: c.scoreLand,
            scoreTech: c.scoreTech,
            scoreGovernance: c.scoreGovernance,
            scoreCommunity: c.scoreCommunity,
            scoreCircularity: c.scoreCircularity,
            techStack: c.techStack,
            communityLife: c.communityLife,
            howToJoin: c.howToJoin,
            landDescription: c.landDescription,
            aiConfidence: c.aiConfidence,
            sourcesCount: c.sourcesCount,
            isPublished: c.isPublished ?? true,
            isFormingDisclaimer: c.isFormingDisclaimer ?? false,
            source: c.source ?? "discovery",
            lastResearchedAt: c.lastResearchedAt ? new Date(c.lastResearchedAt) : new Date(),
            lastRefreshedAt: c.lastRefreshedAt ? new Date(c.lastRefreshedAt) : new Date(),
          });

          if (c.tags?.length) {
            const tagNames = c.tags.map((t: any) => t.tag || t);
            await storage.addTags(community.id, tagNames);
          }

          if (c.links?.length) {
            await storage.addLinks(community.id, c.links.map((l: any) => ({
              url: l.url,
              title: l.title,
              type: l.type,
            })));
          }

          if (c.images?.length) {
            await storage.addImages(community.id, c.images.map((img: any) => ({
              imageUrl: img.imageUrl,
              altText: img.altText,
              sourceUrl: img.sourceUrl,
              isHero: img.isHero,
              sortOrder: img.sortOrder,
            })));
          }

          existingSlugs.add(c.slug);
          imported++;
          console.log(`[import] Added: ${c.name} (${c.slug})`);
        } catch (err: any) {
          errors.push(`${c.name}: ${err.message}`);
        }
      }

      res.json({ imported, skipped, errors });
    } catch (error: any) {
      console.error("Import error:", error);
      res.status(500).json({ error: error?.message || "Import failed" });
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

  app.get("/api/graph", async (_req, res) => {
    try {
      const graphData = await storage.getGraphData();
      res.json(graphData);
    } catch (error) {
      console.error("Graph data error:", error);
      res.status(500).json({ error: "Failed to fetch graph data" });
    }
  });

  // Simple in-memory rate limiter: max 3 submissions per IP per hour
  const submitRateMap = new Map<string, number[]>();

  app.post("/api/people/submit", async (req, res) => {
    try {
      // Honeypot check — bots fill this hidden field
      if (req.body.website_confirm) {
        return res.json({ success: true }); // silent success to confuse bots
      }

      // Rate limiting
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
      const now = Date.now();
      const windowMs = 60 * 60 * 1000; // 1 hour
      const timestamps = (submitRateMap.get(ip) || []).filter((t) => now - t < windowMs);
      if (timestamps.length >= 3) {
        return res.status(429).json({ error: "Too many submissions. Please try again later." });
      }
      timestamps.push(now);
      submitRateMap.set(ip, timestamps);

      const { name, title, orgId, bio, website, avatarUrl } = req.body;

      if (!name || typeof name !== "string" || name.trim().length < 2) {
        return res.status(400).json({ error: "Name is required (at least 2 characters)." });
      }

      const trimmedName = name.trim().slice(0, 120);

      // Generate a unique slug
      const baseSlug = trimmedName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const graphData = await storage.getGraphData();
      const existingSlugs = new Set(graphData.people.map((p) => p.slug));
      let slug = baseSlug;
      let counter = 2;
      while (existingSlugs.has(slug)) {
        slug = `${baseSlug}-${counter++}`;
      }

      // Validate URL fields — only allow http/https
      const sanitizeUrl = (raw: unknown): string | null => {
        if (!raw || typeof raw !== "string") return null;
        const trimmed = raw.trim().slice(0, 500);
        if (!trimmed) return null;
        try {
          const parsed = new URL(trimmed);
          if (!["http:", "https:"].includes(parsed.protocol)) return null;
          return trimmed;
        } catch {
          return null;
        }
      };

      const person = await storage.upsertPerson({
        name: trimmedName,
        slug,
        title: title?.trim().slice(0, 120) || null,
        bio: bio?.trim().slice(0, 1000) || null,
        website: sanitizeUrl(website),
        avatarUrl: sanitizeUrl(avatarUrl),
        linkedIn: null,
      });

      // Treat "none" (the dropdown placeholder value) as no org selected
      const resolvedOrgId = orgId && orgId !== "none" ? orgId : null;
      if (resolvedOrgId && typeof resolvedOrgId === "string") {
        const org = graphData.organizations.find((o) => o.id === resolvedOrgId);
        if (org) {
          await storage.upsertPersonOrgEdge({ personId: person.id, orgId: org.id, role: title?.trim().slice(0, 80) || null });
        }
      }

      res.json({ success: true, person });
    } catch (error: any) {
      console.error("People submit error:", error);
      res.status(500).json({ error: "Failed to add profile. Please try again." });
    }
  });

  app.post("/api/admin/enrich-graph", async (_req, res) => {
    try {
      const { enrichGraphFromAllCommunities } = await import("./graph-enrichment");
      const result = await enrichGraphFromAllCommunities();
      res.json(result);
    } catch (error: any) {
      console.error("Graph enrichment error:", error);
      res.status(500).json({ error: error?.message || "Graph enrichment failed" });
    }
  });

  // ── Newsletter API ────────────────────────────────────────────────────────────

  // Auth helper: verify Bearer CRON_SECRET for sensitive endpoints
  function requireCronSecret(req: any, res: any): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      res.status(503).json({ error: "CRON_SECRET not configured on server" });
      return false;
    }
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ") || auth.slice(7) !== secret) {
      res.status(401).json({ error: "Unauthorized" });
      return false;
    }
    return true;
  }

  // Cron endpoint: Bearer CRON_SECRET required — called by external scheduler
  app.post("/api/cron/research", async (req, res) => {
    if (!requireCronSecret(req, res)) return;
    try {
      const { runNewsletterResearch } = await import("./newsletter-research");
      const result = await runNewsletterResearch();
      res.json(result);
    } catch (error: any) {
      console.error("[cron] Newsletter research error:", error);
      res.status(500).json({ error: error?.message || "Research failed" });
    }
  });

  // Public: subscribe — also accepts name, creates/reactivates subscriber with unsubscribe token
  app.post("/api/newsletter/subscribe", async (req, res) => {
    try {
      const { email, name } = req.body;
      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({ error: "Valid email is required" });
      }
      const { unsubscribeToken: _tok, ...safeSubscriber } = await storage.addEmailSubscriber(
        email.trim().toLowerCase(),
        name?.trim().slice(0, 120) || undefined
      );
      res.json({ success: true, subscriber: safeSubscriber });
    } catch (error) {
      console.error("Newsletter subscribe error:", error);
      res.status(500).json({ error: "Failed to subscribe" });
    }
  });

  // Public: unsubscribe via token — one-click unsubscribe from email footer
  app.get("/api/newsletter/unsubscribe", async (req, res) => {
    try {
      const token = req.query.token as string;
      if (!token) return res.status(400).json({ error: "Token is required" });
      const subscriber = await storage.deactivateSubscriber(token);
      if (!subscriber) return res.status(404).json({ error: "Subscriber not found" });
      res.send(`<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:500px;margin:80px auto;text-align:center;">
        <h1 style="color:#333;">Unsubscribed</h1>
        <p style="color:#666;">You've been removed from SolarpunkDigest. Sorry to see you go!</p>
        <a href="/" style="color:#4a7c59;">← Back to SolarpunkList</a>
      </body></html>`);
    } catch (error) {
      console.error("Unsubscribe error:", error);
      res.status(500).json({ error: "Failed to unsubscribe" });
    }
  });

  // Admin: manual research trigger — requires CRON_SECRET to prevent paid-API abuse
  app.post("/api/newsletter/research", async (req, res) => {
    if (!requireCronSecret(req, res)) return;
    try {
      const { runNewsletterResearch } = await import("./newsletter-research");
      const result = await runNewsletterResearch();
      res.json(result);
    } catch (error: any) {
      console.error("Newsletter research error:", error);
      res.status(500).json({ error: error?.message || "Research failed" });
    }
  });

  // Admin: list newsletter items with filter/sort params
  app.get("/api/newsletter/items", async (req, res) => {
    try {
      const { isFrontier, isSelected, trlRange, subcategoryTag, sort, order } = req.query;
      const items = await storage.listNewsletterItems({
        isFrontier: isFrontier === "true" ? true : isFrontier === "false" ? false : undefined,
        isSelected: isSelected === "true" ? true : isSelected === "false" ? false : undefined,
        trlRange: trlRange as "1-3" | "4-6" | "7-9" | undefined,
        subcategoryTag: subcategoryTag as string | undefined,
        sort: sort as "frontierScore" | "relevanceScore" | "createdAt" | undefined,
        order: order as "asc" | "desc" | undefined,
      });
      res.json(items);
    } catch (error: any) {
      console.error("Newsletter items error:", error);
      res.status(500).json({ error: "Failed to fetch newsletter items" });
    }
  });

  // Admin: update a single item (isSelected, isFrontier, adminNotes, sortOrder)
  app.patch("/api/newsletter/items/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { isSelected, isFrontier, adminNotes, sortOrder } = req.body;
      const data: Record<string, unknown> = {};
      if (isSelected !== undefined) data.isSelected = Boolean(isSelected);
      if (isFrontier !== undefined) data.isFrontier = Boolean(isFrontier);
      if (adminNotes !== undefined) data.adminNotes = String(adminNotes).slice(0, 1000);
      if (sortOrder !== undefined) data.sortOrder = Number(sortOrder);
      const item = await storage.updateNewsletterItem(id, data);
      if (!item) return res.status(404).json({ error: "Item not found" });
      res.json(item);
    } catch (error: any) {
      console.error("Newsletter item update error:", error);
      res.status(500).json({ error: "Failed to update item" });
    }
  });

  // Admin: bulk update items (isSelected, isFrontier)
  app.patch("/api/newsletter/items/bulk", async (req, res) => {
    try {
      const { ids, data } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array is required" });
      }
      const allowed: Record<string, unknown> = {};
      if (data.isSelected !== undefined) allowed.isSelected = Boolean(data.isSelected);
      if (data.isFrontier !== undefined) allowed.isFrontier = Boolean(data.isFrontier);
      await storage.bulkUpdateNewsletterItems(ids, allowed);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Bulk update error:", error);
      res.status(500).json({ error: "Failed to bulk update items" });
    }
  });

  // Admin: generate digest from currently selected items, creates/updates draft issue
  app.post("/api/newsletter/generate", async (_req, res) => {
    try {
      // Find the latest draft issue or create one
      const issues = await storage.listNewsletterDigestIssues();
      let draftIssue = issues.find((i) => i.status === "draft");
      if (!draftIssue) {
        draftIssue = await storage.createNewsletterDigestIssue({ status: "draft" });
      }
      // Always sync currently selected unassigned items into this draft
      // (covers both new draft creation AND the case where items were selected
      // after the draft already existed)
      const selectedUnassigned = await storage.listNewsletterItems({ isSelected: true, digestIssueId: null });
      if (selectedUnassigned.length > 0) {
        await storage.bulkUpdateNewsletterItems(
          selectedUnassigned.map((i) => i.id),
          { digestIssueId: draftIssue.id }
        );
      }
      const { generateDigest } = await import("./newsletter-digest");
      await generateDigest(draftIssue.id);
      const issue = await storage.getNewsletterDigestIssue(draftIssue.id);
      res.json(issue);
    } catch (error: any) {
      console.error("Generate digest error:", error);
      res.status(500).json({ error: error?.message || "Failed to generate digest" });
    }
  });

  // Admin: list digest issues
  app.get("/api/newsletter/issues", async (_req, res) => {
    try {
      const issues = await storage.listNewsletterDigestIssues();
      res.json(issues);
    } catch (error: any) {
      console.error("List issues error:", error);
      res.status(500).json({ error: "Failed to fetch digest issues" });
    }
  });

  // Admin: get single issue with its items
  app.get("/api/newsletter/issues/:id", async (req, res) => {
    try {
      const issue = await storage.getNewsletterDigestIssue(req.params.id);
      if (!issue) return res.status(404).json({ error: "Issue not found" });
      res.json(issue);
    } catch (error: any) {
      console.error("Get issue error:", error);
      res.status(500).json({ error: "Failed to fetch issue" });
    }
  });

  // Admin: update issue subject / intro text / status
  app.patch("/api/newsletter/issues/:id", async (req, res) => {
    try {
      const { subject, introText, status } = req.body;
      const data: Record<string, unknown> = {};
      if (subject !== undefined) data.subject = String(subject).slice(0, 500);
      if (introText !== undefined) data.introText = String(introText).slice(0, 5000);
      if (status !== undefined && ["draft", "generated", "approved", "sent", "discarded"].includes(status)) {
        data.status = status;
      }
      const issue = await storage.updateNewsletterDigestIssue(req.params.id, data);
      if (!issue) return res.status(404).json({ error: "Issue not found" });
      res.json(issue);
    } catch (error: any) {
      console.error("Update issue error:", error);
      res.status(500).json({ error: "Failed to update issue" });
    }
  });

  // Admin: create a new draft issue explicitly
  app.post("/api/newsletter/issues", async (_req, res) => {
    try {
      const issue = await storage.createNewsletterDigestIssue({ status: "draft" });
      // Link currently-selected unassigned items
      const selectedItems = await storage.listNewsletterItems({ isSelected: true, digestIssueId: null });
      if (selectedItems.length > 0) {
        await storage.bulkUpdateNewsletterItems(
          selectedItems.map((i) => i.id),
          { digestIssueId: issue.id }
        );
      }
      res.json(issue);
    } catch (error: any) {
      console.error("Create issue error:", error);
      res.status(500).json({ error: "Failed to create digest issue" });
    }
  });

  // Admin: generate digest for a specific issue
  app.post("/api/newsletter/issues/:id/generate", async (req, res) => {
    try {
      const { generateDigest } = await import("./newsletter-digest");
      await generateDigest(req.params.id);
      const issue = await storage.getNewsletterDigestIssue(req.params.id);
      res.json(issue);
    } catch (error: any) {
      console.error("Generate digest error:", error);
      res.status(500).json({ error: error?.message || "Failed to generate digest" });
    }
  });

  // Admin: send issue — requires CRON_SECRET Bearer OR active session (admin-gated)
  app.post("/api/newsletter/issues/:id/send", async (req, res) => {
    if (!requireCronSecret(req, res)) return;
    try {
      const { sendDigest } = await import("./newsletter-digest");
      const result = await sendDigest(req.params.id);
      res.json(result);
    } catch (error: any) {
      console.error("Send digest error:", error);
      res.status(500).json({ error: error?.message || "Failed to send digest" });
    }
  });

  // Admin: list active subscribers — CRON_SECRET required (PII endpoint)
  app.get("/api/newsletter/subscribers", async (req, res) => {
    if (!requireCronSecret(req, res)) return;
    try {
      const subscribers = await storage.listActiveSubscribers();
      // Strip unsubscribeToken from response — tokens are action keys and must not be publicly enumerable
      const safe = subscribers.map(({ unsubscribeToken: _tok, ...rest }) => rest);
      res.json(safe);
    } catch (error: any) {
      console.error("List subscribers error:", error);
      res.status(500).json({ error: "Failed to fetch subscribers" });
    }
  });

  return httpServer;
}
