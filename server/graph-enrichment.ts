/**
 * Extracts founders/core team from a community profile using Claude,
 * then upserts them into the people/organizations graph.
 */
import Anthropic from "@anthropic-ai/sdk";
import { storage } from "./storage";
import { fetchPersonAvatar } from "./people-image-fetcher";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface ExtractedPerson {
  name: string;
  title: string;
  bio?: string;
  website?: string;
  linkedIn?: string;
  role: string;
}

async function extractPeopleFromCommunity(
  communityName: string,
  websiteUrl: string | null,
  researchContext: string
): Promise<ExtractedPerson[]> {
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `You are helping build a directory of key people in the solarpunk movement. 

Based on the research context below about "${communityName}", extract the FOUNDER(S) and CORE TEAM MEMBERS (up to 3 people total) who are publicly known and named.

RESEARCH CONTEXT:
${researchContext}

Return a JSON array. Each entry must have a real, named individual:
[
  {
    "name": "Full Name",
    "title": "Their role title",
    "bio": "1-2 sentence bio",
    "website": "${websiteUrl || ""}",
    "role": "Founder | Co-founder | Director | Core Team Member"
  }
]

Rules:
- Only include REAL, NAMED individuals mentioned in the research
- Do NOT fabricate people
- If no named individuals are found, return []
- Maximum 3 people
- Return ONLY valid JSON array`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") return [];
    const match = content.text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed.filter((p: any) => p.name && p.name.length > 2) : [];
  } catch (err) {
    console.error(`[graph-enrichment] Claude error for ${communityName}:`, err);
    return [];
  }
}

export async function enrichGraphFromCommunity(
  communityId: string,
  communityName: string,
  communitySlug: string,
  websiteUrl: string | null,
  researchContext: string
): Promise<number> {
  console.log(`[graph-enrichment] Enriching graph for: ${communityName}`);

  // Ensure org node exists for this community
  const org = await storage.upsertOrganization({
    name: communityName,
    slug: communitySlug,
    type: "community",
    website: websiteUrl,
    description: null,
  });

  const extracted = await extractPeopleFromCommunity(communityName, websiteUrl, researchContext);
  if (extracted.length === 0) {
    console.log(`[graph-enrichment] No named people found for ${communityName}`);
    return 0;
  }

  let added = 0;
  for (const personData of extracted) {
    const personSlug = slugify(personData.name);

    // Fetch avatar
    let avatarUrl: string | null = null;
    try {
      avatarUrl = await fetchPersonAvatar(personData.name, websiteUrl);
    } catch {}

    const person = await storage.upsertPerson({
      name: personData.name,
      slug: personSlug,
      title: personData.title,
      bio: personData.bio,
      website: personData.website || websiteUrl,
      linkedIn: personData.linkedIn,
      avatarUrl,
    });

    await storage.upsertPersonOrgEdge({
      personId: person.id,
      orgId: org.id,
      role: personData.role,
    });

    added++;
    console.log(`[graph-enrichment] Added ${personData.name} (${personData.role}) → ${communityName}`);
  }

  return added;
}

export async function enrichGraphFromAllCommunities(): Promise<{
  communitiesProcessed: number;
  peopleAdded: number;
  errors: string[];
}> {
  const communities = await storage.getCommunities();
  const errors: string[] = [];
  let peopleAdded = 0;
  let communitiesProcessed = 0;

  console.log(`[graph-enrichment] Enriching graph from ${communities.length} communities...`);

  for (const community of communities) {
    try {
      const context = [
        community.overview || "",
        community.communityLife || "",
        `Website: ${community.websiteUrl || ""}`,
      ]
        .filter(Boolean)
        .join("\n\n");

      if (context.length < 50) continue;

      const added = await enrichGraphFromCommunity(
        community.id,
        community.name,
        community.slug,
        community.websiteUrl,
        context
      );
      peopleAdded += added;
      communitiesProcessed++;
    } catch (err: any) {
      errors.push(`${community.name}: ${err.message}`);
    }
  }

  console.log(
    `[graph-enrichment] Complete: ${communitiesProcessed} communities, ${peopleAdded} people added`
  );
  return { communitiesProcessed, peopleAdded, errors };
}
