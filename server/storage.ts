import { eq, desc, asc, ilike, and, inArray, sql } from "drizzle-orm";
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
  type Community,
  type InsertCommunity,
  type CommunityWithRelations,
  type CommunityTag,
  type CommunityLink,
  type CommunityImage,
  type EmailSubscriber,
} from "@shared/schema";

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
  addEmailSubscriber(email: string): Promise<EmailSubscriber>;
  getAllSubscriberEmails(): Promise<string[]>;
  trackVisit(path: string): Promise<void>;
  getVisitStats(): Promise<{ totalVisits: number; monthlyAverage: number }>;
}

async function enrichCommunity(community: Community): Promise<CommunityWithRelations> {
  const [tags, links, images] = await Promise.all([
    db.select().from(communityTags).where(eq(communityTags.communityId, community.id)),
    db.select().from(communityLinks).where(eq(communityLinks.communityId, community.id)),
    db.select().from(communityImages).where(eq(communityImages.communityId, community.id)),
  ]);

  return { ...community, tags, links, images };
}

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

  async addEmailSubscriber(email: string): Promise<EmailSubscriber> {
    const [subscriber] = await db
      .insert(emailSubscribers)
      .values({ email })
      .onConflictDoNothing()
      .returning();
    if (!subscriber) {
      const [existing] = await db
        .select()
        .from(emailSubscribers)
        .where(eq(emailSubscribers.email, email));
      return existing;
    }
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

  async getVisitStats(): Promise<{ totalVisits: number; monthlyAverage: number }> {
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(pageVisits);
    const totalVisits = Number(totalResult?.count ?? 0);

    const [firstVisit] = await db
      .select({ earliest: sql<string>`min(visited_at)` })
      .from(pageVisits);

    if (!firstVisit?.earliest || totalVisits === 0) {
      return { totalVisits: 0, monthlyAverage: 0 };
    }

    const earliest = new Date(firstVisit.earliest);
    const now = new Date();
    const monthsDiff = Math.max(
      1,
      (now.getFullYear() - earliest.getFullYear()) * 12 + (now.getMonth() - earliest.getMonth()) + 1
    );
    const monthlyAverage = Math.round(totalVisits / monthsDiff);

    return { totalVisits, monthlyAverage };
  }
}

export const storage = new DatabaseStorage();
