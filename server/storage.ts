import { eq, desc, asc, ilike, and, inArray, gte, lte, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import {
  communities,
  communityTags,
  communityLinks,
  communityImages,
  discoveryRuns,
  refreshRuns,
  emailSubscribers,
  pageVisits,
  organizations,
  people,
  personOrgEdges,
  newsletterResearchRuns,
  newsletterItems,
  newsletterDigestIssues,
  type Community,
  type InsertCommunity,
  type CommunityWithRelations,
  type CommunityTag,
  type CommunityLink,
  type CommunityImage,
  type EmailSubscriber,
  type Organization,
  type InsertOrganization,
  type Person,
  type InsertPerson,
  type PersonOrgEdge,
  type InsertPersonOrgEdge,
  type NewsletterResearchRun,
  type InsertNewsletterResearchRun,
  type NewsletterItem,
  type InsertNewsletterItem,
  type NewsletterDigestIssue,
  type InsertNewsletterDigestIssue,
} from "@shared/schema";

// ── Newsletter filter types ───────────────────────────────────────────────────

export interface NewsletterItemFilters {
  subcategoryTag?: string;
  trlRange?: "1-3" | "4-6" | "7-9";
  isFrontier?: boolean;
  isSelected?: boolean;
  digestIssueId?: string | null;
  from?: Date;
  to?: Date;
  sort?: "frontierScore" | "relevanceScore" | "createdAt";
  order?: "asc" | "desc";
}

// ── Storage interface ─────────────────────────────────────────────────────────

export interface IStorage {
  getCommunities(): Promise<CommunityWithRelations[]>;
  getCommunityBySlug(slug: string): Promise<CommunityWithRelations | undefined>;
  getCommunityById(id: string): Promise<Community | undefined>;
  createCommunity(data: InsertCommunity): Promise<Community>;
  updateCommunity(id: string, data: Partial<InsertCommunity>): Promise<Community | undefined>;
  addTags(communityId: string, tags: string[]): Promise<CommunityTag[]>;
  addLinks(communityId: string, links: { url: string; title?: string; type?: string }[]): Promise<CommunityLink[]>;
  addImages(communityId: string, images: { imageUrl: string; altText?: string; sourceUrl?: string; isHero?: boolean; sortOrder?: number }[]): Promise<CommunityImage[]>;
  getImagesByCommunityId(communityId: string): Promise<CommunityImage[]>;
  getCommunityCount(): Promise<number>;
  getAllPublishedSlugs(): Promise<string[]>;
  addEmailSubscriber(email: string, name?: string): Promise<EmailSubscriber>;
  getAllSubscriberEmails(): Promise<string[]>;
  trackVisit(path: string): Promise<void>;
  getVisitStats(): Promise<{ totalVisits: number; monthlyAverage: number; userSubmissions: number }>;

  // Social graph
  getPeopleCount(): Promise<number>;
  upsertOrganization(data: Omit<InsertOrganization, "logoUrl"> & { logoUrl?: string | null; description?: string | null }): Promise<Organization>;
  upsertPerson(data: InsertPerson): Promise<Person>;
  upsertPersonOrgEdge(data: InsertPersonOrgEdge): Promise<PersonOrgEdge>;
  getGraphData(): Promise<{
    organizations: Organization[];
    people: Person[];
    edges: PersonOrgEdge[];
  }>;

  // Newsletter — research runs
  createNewsletterResearchRun(data?: Partial<InsertNewsletterResearchRun>): Promise<NewsletterResearchRun>;
  updateNewsletterResearchRun(id: string, data: Partial<InsertNewsletterResearchRun>): Promise<NewsletterResearchRun | undefined>;

  // Newsletter — items
  createNewsletterItem(data: InsertNewsletterItem): Promise<NewsletterItem>;
  listNewsletterItems(filters?: NewsletterItemFilters): Promise<NewsletterItem[]>;
  updateNewsletterItem(id: string, data: Partial<InsertNewsletterItem>): Promise<NewsletterItem | undefined>;
  bulkUpdateNewsletterItems(ids: string[], data: Partial<InsertNewsletterItem>): Promise<void>;
  getExistingNewsletterSourceUrls(): Promise<Set<string>>;

  // Newsletter — digest issues
  createNewsletterDigestIssue(data?: Partial<InsertNewsletterDigestIssue>): Promise<NewsletterDigestIssue>;
  getNewsletterDigestIssue(id: string): Promise<(NewsletterDigestIssue & { items: NewsletterItem[] }) | undefined>;
  listNewsletterDigestIssues(): Promise<NewsletterDigestIssue[]>;
  updateNewsletterDigestIssue(id: string, data: Partial<InsertNewsletterDigestIssue>): Promise<NewsletterDigestIssue | undefined>;

  // Newsletter — subscribers
  listActiveSubscribers(): Promise<EmailSubscriber[]>;
  deactivateSubscriber(token: string): Promise<EmailSubscriber | undefined>;
  updateEmailSubscriber(id: string, data: Partial<EmailSubscriber>): Promise<EmailSubscriber | undefined>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function enrichCommunity(community: Community): Promise<CommunityWithRelations> {
  const [tags, links, images] = await Promise.all([
    db.select().from(communityTags).where(eq(communityTags.communityId, community.id)),
    db.select().from(communityLinks).where(eq(communityLinks.communityId, community.id)),
    db.select().from(communityImages).where(eq(communityImages.communityId, community.id)),
  ]);

  return { ...community, tags, links, images };
}

// ── Implementation ────────────────────────────────────────────────────────────

export class DatabaseStorage implements IStorage {
  async getCommunities(): Promise<CommunityWithRelations[]> {
    const allCommunities = await db
      .select()
      .from(communities)
      .where(eq(communities.isPublished, true))
      .orderBy(desc(communities.solarpunkScore));

    return Promise.all(allCommunities.map(enrichCommunity));
  }

  async getCommunityBySlug(slug: string): Promise<CommunityWithRelations | undefined> {
    const [community] = await db
      .select()
      .from(communities)
      .where(eq(communities.slug, slug));

    if (!community) return undefined;
    return enrichCommunity(community);
  }

  async getCommunityById(id: string): Promise<Community | undefined> {
    const [community] = await db
      .select()
      .from(communities)
      .where(eq(communities.id, id));
    return community;
  }

  async createCommunity(data: InsertCommunity): Promise<Community> {
    const [community] = await db.insert(communities).values(data).returning();
    return community;
  }

  async updateCommunity(id: string, data: Partial<InsertCommunity>): Promise<Community | undefined> {
    const [community] = await db
      .update(communities)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(communities.id, id))
      .returning();
    return community;
  }

  async addTags(communityId: string, tags: string[]): Promise<CommunityTag[]> {
    if (tags.length === 0) return [];
    const values = tags.map((tag) => ({ communityId, tag }));
    return db.insert(communityTags).values(values).returning();
  }

  async addLinks(communityId: string, links: { url: string; title?: string; type?: string }[]): Promise<CommunityLink[]> {
    if (links.length === 0) return [];
    const values = links.map((link) => ({ communityId, ...link }));
    return db.insert(communityLinks).values(values).returning();
  }

  async addImages(communityId: string, images: { imageUrl: string; altText?: string; sourceUrl?: string; isHero?: boolean; sortOrder?: number }[]): Promise<CommunityImage[]> {
    if (images.length === 0) return [];
    const values = images.map((img) => ({ communityId, ...img }));
    return db.insert(communityImages).values(values).returning();
  }

  async getImagesByCommunityId(communityId: string): Promise<CommunityImage[]> {
    return db.select().from(communityImages).where(eq(communityImages.communityId, communityId));
  }

  async getCommunityCount(): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(communities);
    return Number(result?.count ?? 0);
  }

  async getAllPublishedSlugs(): Promise<string[]> {
    const results = await db
      .select({ slug: communities.slug })
      .from(communities)
      .where(eq(communities.isPublished, true));
    return results.map((r) => r.slug);
  }

  async addEmailSubscriber(email: string, name?: string): Promise<EmailSubscriber> {
    const token = crypto.randomUUID();
    const [subscriber] = await db
      .insert(emailSubscribers)
      .values({ email, name, isActive: true, unsubscribeToken: token })
      .onConflictDoUpdate({
        target: emailSubscribers.email,
        set: { isActive: true, unsubscribedAt: null, ...(name ? { name } : {}) },
      })
      .returning();
    return subscriber;
  }

  async getAllSubscriberEmails(): Promise<string[]> {
    const results = await db
      .select({ email: emailSubscribers.email })
      .from(emailSubscribers);
    return results.map((r) => r.email);
  }

  async trackVisit(path: string): Promise<void> {
    await db.insert(pageVisits).values({ path });
  }

  async getVisitStats(): Promise<{ totalVisits: number; monthlyAverage: number; userSubmissions: number }> {
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(pageVisits);
    const totalVisits = Number(totalResult?.count ?? 0);

    const [submissionResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(communities)
      .where(eq(communities.source, "submission"));
    const userSubmissions = Number(submissionResult?.count ?? 0);

    const [firstVisit] = await db
      .select({ earliest: sql<string>`min(visited_at)` })
      .from(pageVisits);

    if (!firstVisit?.earliest || totalVisits === 0) {
      return { totalVisits: 0, monthlyAverage: 0, userSubmissions };
    }

    const earliest = new Date(firstVisit.earliest);
    const now = new Date();
    const monthsDiff = Math.max(
      1,
      (now.getFullYear() - earliest.getFullYear()) * 12 + (now.getMonth() - earliest.getMonth()) + 1
    );
    const monthlyAverage = Math.round(totalVisits / monthsDiff);

    return { totalVisits, monthlyAverage, userSubmissions };
  }

  // ── Social Graph ────────────────────────────────────────────────────────────

  async getPeopleCount(): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(people);
    return Number(result?.count ?? 0);
  }

  async upsertOrganization(
    data: Omit<InsertOrganization, "logoUrl"> & { logoUrl?: string | null; description?: string | null }
  ): Promise<Organization> {
    const [org] = await db
      .insert(organizations)
      .values({
        name: data.name,
        slug: data.slug,
        type: data.type ?? "community",
        website: data.website,
        description: data.description,
        logoUrl: data.logoUrl,
      })
      .onConflictDoUpdate({
        target: organizations.slug,
        set: {
          name: data.name,
          website: data.website,
          description: data.description,
          logoUrl: data.logoUrl,
        },
      })
      .returning();
    return org;
  }

  async upsertPerson(data: InsertPerson): Promise<Person> {
    const [person] = await db
      .insert(people)
      .values(data)
      .onConflictDoUpdate({
        target: people.slug,
        set: {
          name: data.name,
          title: data.title,
          bio: data.bio,
          website: data.website,
          linkedIn: data.linkedIn,
          ...(data.avatarUrl ? { avatarUrl: data.avatarUrl } : {}),
        },
      })
      .returning();
    return person;
  }

  async upsertPersonOrgEdge(data: InsertPersonOrgEdge): Promise<PersonOrgEdge> {
    const [edge] = await db
      .insert(personOrgEdges)
      .values(data)
      .onConflictDoUpdate({
        target: [personOrgEdges.personId, personOrgEdges.orgId],
        set: { role: data.role },
      })
      .returning();
    return edge;
  }

  async getGraphData(): Promise<{
    organizations: Organization[];
    people: Person[];
    edges: PersonOrgEdge[];
  }> {
    const [orgs, persons, edges] = await Promise.all([
      db.select().from(organizations),
      db.select().from(people),
      db.select().from(personOrgEdges),
    ]);
    return { organizations: orgs, people: persons, edges };
  }

  // ── Newsletter — Research Runs ───────────────────────────────────────────────

  async createNewsletterResearchRun(data: Partial<InsertNewsletterResearchRun> = {}): Promise<NewsletterResearchRun> {
    const [run] = await db
      .insert(newsletterResearchRuns)
      .values({ queriesExecuted: 0, itemsFound: 0, itemsNew: 0, itemsDuplicate: 0, ...data })
      .returning();
    return run;
  }

  async updateNewsletterResearchRun(id: string, data: Partial<InsertNewsletterResearchRun>): Promise<NewsletterResearchRun | undefined> {
    const [run] = await db
      .update(newsletterResearchRuns)
      .set(data)
      .where(eq(newsletterResearchRuns.id, id))
      .returning();
    return run;
  }

  // ── Newsletter — Items ───────────────────────────────────────────────────────

  async createNewsletterItem(data: InsertNewsletterItem): Promise<NewsletterItem> {
    const [item] = await db
      .insert(newsletterItems)
      .values(data)
      .onConflictDoNothing()
      .returning();
    return item;
  }

  async listNewsletterItems(filters: NewsletterItemFilters = {}): Promise<NewsletterItem[]> {
    const conditions = [];

    if (filters.subcategoryTag) {
      conditions.push(sql`${filters.subcategoryTag} = ANY(${newsletterItems.subcategoryTags})`);
    }

    if (filters.trlRange) {
      const [min, max] = filters.trlRange.split("-").map(Number);
      conditions.push(gte(newsletterItems.trlLevel, min));
      conditions.push(lte(newsletterItems.trlLevel, max));
    }

    if (filters.isFrontier !== undefined) {
      conditions.push(eq(newsletterItems.isFrontier, filters.isFrontier));
    }

    if (filters.isSelected !== undefined) {
      conditions.push(eq(newsletterItems.isSelected, filters.isSelected));
    }

    if (filters.digestIssueId === null) {
      conditions.push(isNull(newsletterItems.digestIssueId));
    } else if (filters.digestIssueId !== undefined) {
      conditions.push(eq(newsletterItems.digestIssueId, filters.digestIssueId));
    }

    if (filters.from) {
      conditions.push(gte(newsletterItems.createdAt, filters.from));
    }

    if (filters.to) {
      conditions.push(lte(newsletterItems.createdAt, filters.to));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const sortCol = filters.sort === "frontierScore"
      ? newsletterItems.frontierScore
      : filters.sort === "relevanceScore"
        ? newsletterItems.relevanceScore
        : newsletterItems.createdAt;

    const sortDir = filters.order === "asc" ? asc(sortCol) : desc(sortCol);

    // Always put frontier items first, then apply the requested sort
    const query = db
      .select()
      .from(newsletterItems)
      .$dynamic();

    if (where) {
      query.where(where);
    }

    return query.orderBy(desc(newsletterItems.isFrontier), sortDir);
  }

  async updateNewsletterItem(id: string, data: Partial<InsertNewsletterItem>): Promise<NewsletterItem | undefined> {
    const [item] = await db
      .update(newsletterItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(newsletterItems.id, id))
      .returning();
    return item;
  }

  async bulkUpdateNewsletterItems(ids: string[], data: Partial<InsertNewsletterItem>): Promise<void> {
    if (ids.length === 0) return;
    await db
      .update(newsletterItems)
      .set({ ...data, updatedAt: new Date() })
      .where(inArray(newsletterItems.id, ids));
  }

  async getExistingNewsletterSourceUrls(): Promise<Set<string>> {
    const results = await db
      .select({ sourceUrl: newsletterItems.sourceUrl })
      .from(newsletterItems);
    return new Set(results.map((r) => r.sourceUrl));
  }

  // ── Newsletter — Digest Issues ───────────────────────────────────────────────

  async createNewsletterDigestIssue(data: Partial<InsertNewsletterDigestIssue> = {}): Promise<NewsletterDigestIssue> {
    const [issue] = await db
      .insert(newsletterDigestIssues)
      .values({ status: "draft", ...data })
      .returning();
    return issue;
  }

  async getNewsletterDigestIssue(id: string): Promise<(NewsletterDigestIssue & { items: NewsletterItem[] }) | undefined> {
    const [issue] = await db
      .select()
      .from(newsletterDigestIssues)
      .where(eq(newsletterDigestIssues.id, id));

    if (!issue) return undefined;

    const items = await db
      .select()
      .from(newsletterItems)
      .where(eq(newsletterItems.digestIssueId, id))
      .orderBy(asc(newsletterItems.sortOrder));

    return { ...issue, items };
  }

  async listNewsletterDigestIssues(): Promise<NewsletterDigestIssue[]> {
    return db
      .select()
      .from(newsletterDigestIssues)
      .orderBy(desc(newsletterDigestIssues.issueNumber));
  }

  async updateNewsletterDigestIssue(id: string, data: Partial<InsertNewsletterDigestIssue>): Promise<NewsletterDigestIssue | undefined> {
    const [issue] = await db
      .update(newsletterDigestIssues)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(newsletterDigestIssues.id, id))
      .returning();
    return issue;
  }

  // ── Newsletter — Subscribers ─────────────────────────────────────────────────

  async listActiveSubscribers(): Promise<EmailSubscriber[]> {
    return db
      .select()
      .from(emailSubscribers)
      .where(eq(emailSubscribers.isActive, true))
      .orderBy(asc(emailSubscribers.createdAt));
  }

  async deactivateSubscriber(token: string): Promise<EmailSubscriber | undefined> {
    const [subscriber] = await db
      .update(emailSubscribers)
      .set({ isActive: false, unsubscribedAt: new Date() })
      .where(eq(emailSubscribers.unsubscribeToken, token))
      .returning();
    return subscriber;
  }

  async updateEmailSubscriber(id: string, data: Partial<EmailSubscriber>): Promise<EmailSubscriber | undefined> {
    const [subscriber] = await db
      .update(emailSubscribers)
      .set(data)
      .where(eq(emailSubscribers.id, id))
      .returning();
    return subscriber;
  }
}

export const storage = new DatabaseStorage();
