import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  real,
  timestamp,
  jsonb,
  serial,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const communities = pgTable("communities", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  tagline: text("tagline"),
  overview: text("overview"),
  locationCountry: text("location_country"),
  locationRegion: text("location_region"),
  locationLat: real("location_lat"),
  locationLng: real("location_lng"),
  stage: text("stage"),
  population: integer("population"),
  foundedYear: integer("founded_year"),
  websiteUrl: text("website_url"),
  heroImageUrl: text("hero_image_url"),
  solarpunkScore: real("solarpunk_score"),
  scoreEnergy: real("score_energy"),
  scoreLand: real("score_land"),
  scoreTech: real("score_tech"),
  scoreGovernance: real("score_governance"),
  scoreCommunity: real("score_community"),
  scoreCircularity: real("score_circularity"),
  techStack: jsonb("tech_stack"),
  communityLife: text("community_life"),
  howToJoin: text("how_to_join"),
  landDescription: text("land_description"),
  aiConfidence: real("ai_confidence"),
  sourcesCount: integer("sources_count").default(0),
  lastResearchedAt: timestamp("last_researched_at"),
  lastRefreshedAt: timestamp("last_refreshed_at"),
  refreshCount: integer("refresh_count").default(0),
  isPublished: boolean("is_published").default(false),
  isFormingDisclaimer: boolean("is_forming_disclaimer").default(false),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const communityTags = pgTable("community_tags", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  communityId: uuid("community_id")
    .notNull()
    .references(() => communities.id, { onDelete: "cascade" }),
  tag: text("tag").notNull(),
});

export const communityLinks = pgTable("community_links", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  communityId: uuid("community_id")
    .notNull()
    .references(() => communities.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  title: text("title"),
  type: text("type"),
});

export const communityImages = pgTable("community_images", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  communityId: uuid("community_id")
    .notNull()
    .references(() => communities.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  altText: text("alt_text"),
  sourceUrl: text("source_url"),
  isHero: boolean("is_hero").default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const discoveryRuns = pgTable("discovery_runs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  runDate: timestamp("run_date").default(sql`now()`),
  queriesExecuted: integer("queries_executed").default(0),
  resultsFound: integer("results_found").default(0),
  duplicatesSkipped: integer("duplicates_skipped").default(0),
  newCommunitiesAdded: integer("new_communities_added").default(0),
  errors: jsonb("errors"),
  status: text("status").default("pending"),
});

export const refreshRuns = pgTable("refresh_runs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  runDate: timestamp("run_date").default(sql`now()`),
  communitiesChecked: integer("communities_checked").default(0),
  contentChangesDetected: integer("content_changes_detected").default(0),
  stageChanges: integer("stage_changes").default(0),
  dormantFlagged: integer("dormant_flagged").default(0),
  errors: jsonb("errors"),
  status: text("status").default("pending"),
});

export const insertCommunitySchema = createInsertSchema(communities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommunityTagSchema = createInsertSchema(communityTags).omit({
  id: true,
});

export const insertCommunityLinkSchema = createInsertSchema(communityLinks).omit({
  id: true,
});

export const insertCommunityImageSchema = createInsertSchema(communityImages).omit({
  id: true,
  createdAt: true,
});

export type Community = typeof communities.$inferSelect;
export type InsertCommunity = z.infer<typeof insertCommunitySchema>;
export type CommunityTag = typeof communityTags.$inferSelect;
export type CommunityLink = typeof communityLinks.$inferSelect;
export type CommunityImage = typeof communityImages.$inferSelect;
export type DiscoveryRun = typeof discoveryRuns.$inferSelect;
export type RefreshRun = typeof refreshRuns.$inferSelect;

export type CommunityWithRelations = Community & {
  tags: CommunityTag[];
  links: CommunityLink[];
  images: CommunityImage[];
};
