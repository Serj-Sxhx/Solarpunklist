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
