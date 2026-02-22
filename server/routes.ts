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
