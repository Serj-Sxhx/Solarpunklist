import Anthropic from "@anthropic-ai/sdk";
import { storage } from "./storage";
import { db } from "./db";
import { discoveryRuns, communities } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

const DISCOVERY_QUERIES = [
  "intentional community regenerative technology solar off-grid",
  "ecovillage IoT sensors permaculture smart grid",
  "solarpunk land project decentralized infrastructure",
  "regenerative community robotics automation green energy",
  "off-grid community drone agriculture water recycling",
  "community land trust renewable energy food forest tech",
  "cooperative ecovillage blockchain governance solar",
  "earth-ship community aquaponics renewable",
  "bioregional community open source hardware",
  "transition town technology permaculture design",
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function searchExa(query: string): Promise<any[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    console.warn("EXA_API_KEY not set, skipping Exa search");
    return [];
  }

  try {
    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        query,
        type: "neural",
        numResults: 10,
        contents: {
          text: { maxCharacters: 3000 },
        },
      }),
    });

    if (!response.ok) {
      console.error(`Exa search failed: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("Exa search error:", error);
    return [];
  }
}

async function generateCommunityProfile(
  name: string,
  context: string
): Promise<any | null> {
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `You are a researcher specializing in intentional communities, ecovillages, and regenerative land projects. Based on the following research about "${name}", generate a comprehensive community profile.

RESEARCH CONTEXT:
${context}

Generate a JSON object with these fields:
{
  "name": "Official community name",
  "tagline": "One compelling sentence describing the community",
  "overview": "2-3 paragraphs, editorial tone describing the community",
  "stage": "forming|established|mature",
  "founded_year": number or null,
  "population": number or null,
  "location_country": "Country name",
  "location_region": "State/Province/Region",
  "website_url": "primary website URL or null",
  "scores": {
    "energy": { "score": 0-10, "reasoning": "brief explanation" },
    "land": { "score": 0-10, "reasoning": "brief explanation" },
    "tech": { "score": 0-10, "reasoning": "brief explanation" },
    "governance": { "score": 0-10, "reasoning": "brief explanation" },
    "community": { "score": 0-10, "reasoning": "brief explanation" },
    "circularity": { "score": 0-10, "reasoning": "brief explanation" }
  },
  "tech_stack": {
    "energy": ["list of energy technologies"],
    "water": ["list of water technologies"],
    "food": ["list of food technologies"],
    "shelter": ["list of shelter technologies"],
    "digital": ["list of digital technologies"],
    "governance": ["list of governance tools"]
  },
  "land_description": "Description of the land and terrain",
  "community_life": "Description of daily life and culture",
  "how_to_join": "How to visit or join the community",
  "tags": ["tag1", "tag2", ...],
  "ai_confidence": 0.0-1.0,
  "is_forming_disclaimer": true/false
}

IMPORTANT:
- Cite evidence for every score
- Default to lower scores when information is sparse
- Never fabricate details
- Flag when information is uncertain
- Set ai_confidence based on how much verifiable information you found
- Return ONLY valid JSON, no markdown wrapping`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") return null;

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("LLM profile generation error:", error);
    return null;
  }
}

export async function runDiscovery(): Promise<{
  queriesExecuted: number;
  resultsFound: number;
  duplicatesSkipped: number;
  newCommunitiesAdded: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let resultsFound = 0;
  let duplicatesSkipped = 0;
  let newCommunitiesAdded = 0;

  const existingSlugs = await storage.getAllPublishedSlugs();
  const existingNames = new Set(
    existingSlugs.map((s) => s.replace(/-/g, " ").toLowerCase())
  );

  const queriesToRun = DISCOVERY_QUERIES.slice(0, 5);
  const allResults: any[] = [];

  for (const query of queriesToRun) {
    try {
      const results = await searchExa(query);
      allResults.push(...results);
      resultsFound += results.length;
    } catch (error) {
      errors.push(`Search failed for query "${query}": ${error}`);
    }
  }

  const uniqueResults = new Map<string, any>();
  for (const result of allResults) {
    if (result.url && !uniqueResults.has(result.url)) {
      uniqueResults.set(result.url, result);
    }
  }

  for (const [url, result] of uniqueResults) {
    try {
      const title = result.title || "";
      const potentialSlug = slugify(title);

      if (existingNames.has(title.toLowerCase()) || existingSlugs.includes(potentialSlug)) {
        duplicatesSkipped++;
        continue;
      }

      const context = `Title: ${result.title}\nURL: ${result.url}\nContent: ${result.text || "No content available"}`;

      const profile = await generateCommunityProfile(title, context);
      if (!profile || !profile.name) continue;

      const slug = slugify(profile.name);
      if (existingSlugs.includes(slug)) {
        duplicatesSkipped++;
        continue;
      }

      const solarpunkScore =
        (profile.scores.energy.score * 20 +
          profile.scores.land.score * 20 +
          profile.scores.tech.score * 20 +
          profile.scores.governance.score * 15 +
          profile.scores.community.score * 15 +
          profile.scores.circularity.score * 10) /
        10;

      const community = await storage.createCommunity({
        name: profile.name,
        slug,
        tagline: profile.tagline,
        overview: profile.overview,
        locationCountry: profile.location_country,
        locationRegion: profile.location_region,
        stage: profile.stage,
        population: profile.population,
        foundedYear: profile.founded_year,
        websiteUrl: profile.website_url,
        solarpunkScore,
        scoreEnergy: profile.scores.energy.score,
        scoreLand: profile.scores.land.score,
        scoreTech: profile.scores.tech.score,
        scoreGovernance: profile.scores.governance.score,
        scoreCommunity: profile.scores.community.score,
        scoreCircularity: profile.scores.circularity.score,
        techStack: profile.tech_stack,
        communityLife: profile.community_life,
        howToJoin: profile.how_to_join,
        landDescription: profile.land_description,
        aiConfidence: profile.ai_confidence,
        sourcesCount: 1,
        isPublished: profile.ai_confidence > 0.7,
        isFormingDisclaimer: profile.is_forming_disclaimer,
        lastResearchedAt: new Date(),
        lastRefreshedAt: new Date(),
      });

      if (profile.tags?.length) {
        await storage.addTags(community.id, profile.tags);
      }

      if (profile.website_url) {
        await storage.addLinks(community.id, [
          { url: profile.website_url, title: "Official Website", type: "website" },
        ]);
      }

      existingSlugs.push(slug);
      existingNames.add(profile.name.toLowerCase());
      newCommunitiesAdded++;
    } catch (error) {
      errors.push(`Processing failed for ${url}: ${error}`);
    }
  }

  await db.insert(discoveryRuns).values({
    queriesExecuted: queriesToRun.length,
    resultsFound,
    duplicatesSkipped,
    newCommunitiesAdded,
    errors: errors.length > 0 ? errors : null,
    status: "completed",
  });

  console.log(
    `Discovery complete: ${queriesToRun.length} queries, ${resultsFound} results, ${duplicatesSkipped} duplicates, ${newCommunitiesAdded} new communities`
  );

  return {
    queriesExecuted: queriesToRun.length,
    resultsFound,
    duplicatesSkipped,
    newCommunitiesAdded,
    errors,
  };
}
