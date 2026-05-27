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
  unique,
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
  source: text("source").default("discovery"),
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

export const emailSubscribers = pgTable("email_subscribers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name"),
  isActive: boolean("is_active").default(true),
  unsubscribedAt: timestamp("unsubscribed_at"),
  unsubscribeToken: text("unsubscribe_token"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const insertEmailSubscriberSchema = createInsertSchema(emailSubscribers).omit({
  id: true,
  createdAt: true,
});

export type EmailSubscriber = typeof emailSubscribers.$inferSelect;
export type InsertEmailSubscriber = z.infer<typeof insertEmailSubscriberSchema>;

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

export const pageVisits = pgTable("page_visits", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  path: text("path").notNull(),
  visitedAt: timestamp("visited_at").default(sql`now()`),
});

export type PageVisit = typeof pageVisits.$inferSelect;

export type CommunityWithRelations = Community & {
  tags: CommunityTag[];
  links: CommunityLink[];
  images: CommunityImage[];
};

// ── Social Graph ──────────────────────────────────────────────────────────────

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  type: text("type").notNull().default("community"), // "community" | "external"
  website: text("website"),
  description: text("description"),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const people = pgTable("people", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  title: text("title"),
  bio: text("bio"),
  website: text("website"),
  avatarUrl: text("avatar_url"),
  linkedIn: text("linked_in"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const personOrgEdges = pgTable(
  "person_org_edges",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: text("role"),
    createdAt: timestamp("created_at").default(sql`now()`),
  },
  (table) => ({
    personOrgUnique: unique().on(table.personId, table.orgId),
  })
);

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
});

export const insertPersonSchema = createInsertSchema(people).omit({
  id: true,
  createdAt: true,
});

export const insertPersonOrgEdgeSchema = createInsertSchema(personOrgEdges).omit({
  id: true,
  createdAt: true,
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Person = typeof people.$inferSelect;
export type InsertPerson = z.infer<typeof insertPersonSchema>;
export type PersonOrgEdge = typeof personOrgEdges.$inferSelect;
export type InsertPersonOrgEdge = z.infer<typeof insertPersonOrgEdgeSchema>;

// ── Newsletter ────────────────────────────────────────────────────────────────

export const newsletterResearchRuns = pgTable("newsletter_research_runs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  runDate: timestamp("run_date").default(sql`now()`),
  queriesExecuted: integer("queries_executed").default(0),
  itemsFound: integer("items_found").default(0),
  itemsNew: integer("items_new").default(0),
  itemsDuplicate: integer("items_duplicate").default(0),
  errors: jsonb("errors"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const newsletterDigestIssues = pgTable("newsletter_digest_issues", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  issueNumber: serial("issue_number").unique(),
  subject: text("subject"),
  introText: text("intro_text"),
  generatedHtml: text("generated_html"),
  generatedMarkdown: text("generated_markdown"),
  status: text("status").default("draft"), // draft | generated | approved | sent | discarded
  sentAt: timestamp("sent_at"),
  recipientCount: integer("recipient_count"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const newsletterItems = pgTable("newsletter_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  researchRunId: uuid("research_run_id").references(() => newsletterResearchRuns.id),
  title: text("title").notNull(),
  summary: text("summary"),
  sourceUrl: text("source_url").unique().notNull(),
  sourceDomain: text("source_domain"),
  publishedAt: timestamp("published_at"),
  subcategoryTags: text("subcategory_tags").array().default(sql`'{}'::text[]`),
  tags: text("tags").array().default(sql`'{}'::text[]`),
  relevanceScore: real("relevance_score"),
  trlLevel: integer("trl_level"),
  trlReasoning: text("trl_reasoning"),
  frontierScore: real("frontier_score"),
  isFrontier: boolean("is_frontier").default(false),
  imageUrl: text("image_url"),
  isSelected: boolean("is_selected").default(false),
  adminNotes: text("admin_notes"),
  digestIssueId: uuid("digest_issue_id").references(() => newsletterDigestIssues.id),
  sortOrder: integer("sort_order"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const insertNewsletterResearchRunSchema = createInsertSchema(newsletterResearchRuns).omit({
  id: true,
  createdAt: true,
});

export const insertNewsletterItemSchema = createInsertSchema(newsletterItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNewsletterDigestIssueSchema = createInsertSchema(newsletterDigestIssues).omit({
  id: true,
  issueNumber: true,
  createdAt: true,
  updatedAt: true,
});

export type NewsletterResearchRun = typeof newsletterResearchRuns.$inferSelect;
export type InsertNewsletterResearchRun = z.infer<typeof insertNewsletterResearchRunSchema>;
export type NewsletterItem = typeof newsletterItems.$inferSelect;
export type InsertNewsletterItem = z.infer<typeof insertNewsletterItemSchema>;
export type NewsletterDigestIssue = typeof newsletterDigestIssues.$inferSelect;
export type InsertNewsletterDigestIssue = z.infer<typeof insertNewsletterDigestIssueSchema>;
