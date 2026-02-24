import Anthropic from "@anthropic-ai/sdk";
import { storage } from "./storage";
import { db } from "./db";
import { discoveryRuns } from "@shared/schema";
import { fetchAndStoreImages } from "./image-fetcher";
import { notifySubscribers } from "./email-notifications";

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

async function extractCommunityNames(
  searchResults: any[],
  existingNames: string[]
): Promise<{ name: string; sources: string[] }[]> {
  const combinedContext = searchResults
    .map((r: any) => `Title: ${r.title}\nURL: ${r.url}\nContent: ${(r.text || "").substring(0, 1500)}`)
    .join("\n\n---\n\n");

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `You are a researcher finding intentional communities, ecovillages, and regenerative land projects. Analyze the following web search results and extract the names of SPECIFIC, REAL communities or projects mentioned.

IMPORTANT: These communities ALREADY EXIST in our database, so DO NOT include them:
${existingNames.map((n) => `- ${n}`).join("\n")}

SEARCH RESULTS:
${combinedContext}

Return a JSON array of NEW communities NOT in the list above. Each entry should have:
- "name": the official/common name of the community
- "sources": array of URLs where this community was mentioned

Rules:
- Only include real, specific communities with a physical location
- Do NOT include organizations, networks, or umbrella groups (e.g., "Global Ecovillage Network" is not a community)
- Do NOT include any community already in the existing list above
- Do NOT fabricate communities - they must be explicitly mentioned in the search results
- Include at most 5 communities to keep quality high

Return ONLY a valid JSON array like: [{"name": "Community Name", "sources": ["url1"]}]
If no new communities are found, return: []`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") return [];

    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Community extraction error:", error);
    return [];
  }
}

async function researchAndProfileCommunity(
  name: string,
  initialSources: string[]
): Promise<any | null> {
  const additionalResults = await searchExa(`"${name}" intentional community ecovillage`);

  const allContext = additionalResults
    .map((r: any) => `Title: ${r.title}\nURL: ${r.url}\nContent: ${r.text || ""}`)
    .join("\n\n---\n\n");

  if (!allContext || allContext.length < 100) {
    console.log(`  Skipping ${name} - insufficient research data`);
    return null;
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `You are a researcher specializing in intentional communities, ecovillages, and regenerative land projects. Based on the following research about "${name}", generate a comprehensive community profile.

RESEARCH CONTEXT:
${allContext}

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
  "location_lat": number or null,
  "location_lng": number or null,
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

export async function researchFromUrl(url: string): Promise<{
  slug: string;
  name: string;
}> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    throw new Error("EXA_API_KEY not configured — cannot research URLs");
  }

  let pageContent = "";
  let pageTitle = "";
  try {
    const response = await fetch("https://api.exa.ai/contents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        urls: [url],
        text: { maxCharacters: 5000 },
      }),
    });
    if (response.ok) {
      const data = await response.json();
      const result = data.results?.[0];
      if (result) {
        pageContent = result.text || "";
        pageTitle = result.title || "";
      }
    }
  } catch {}

  if (!pageContent || pageContent.length < 50) {
    try {
      const resp = await fetch(url, {
        headers: { "User-Agent": "SolarpunkListBot/1.0" },
        signal: AbortSignal.timeout(10000),
      });
      const html = await resp.text();
      pageContent = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").substring(0, 5000);
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) pageTitle = titleMatch[1];
    } catch {
      throw new Error("Could not fetch content from this URL. Please check the URL and try again.");
    }
  }

  if (pageContent.length < 50) {
    throw new Error("Not enough content found at this URL to generate a community profile.");
  }

  const contextForLLM = `Title: ${pageTitle}\nURL: ${url}\nContent: ${pageContent}`;

  const nameMsg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Analyze this web page and determine if it represents an intentional community, ecovillage, regenerative land project, or similar solarpunk community.

PAGE CONTENT:
${contextForLLM}

If this IS a community/project, return a JSON object: {"name": "Community Name", "is_community": true}
If this is NOT a community/project, return: {"name": "", "is_community": false, "reason": "brief reason"}

Return ONLY valid JSON.`,
      },
    ],
  });

  const nameContent = nameMsg.content[0];
  if (nameContent.type !== "text") throw new Error("Failed to analyze the URL.");

  const nameJson = JSON.parse(nameContent.text.match(/\{[\s\S]*\}/)?.[0] || "{}");
  if (!nameJson.is_community) {
    throw new Error(nameJson.reason || "This URL doesn't appear to be a solarpunk community or regenerative project.");
  }

  const communityName = nameJson.name;
  const slug = slugify(communityName);

  const existingSlugs = await storage.getAllPublishedSlugs();
  if (existingSlugs.includes(slug)) {
    throw new Error(`"${communityName}" is already in our directory!`);
  }

  const profile = await researchAndProfileCommunity(communityName, [url]);
  if (!profile || !profile.name) {
    throw new Error("Could not generate a profile for this community. Please try a different URL.");
  }

  const finalSlug = slugify(profile.name);
  if (existingSlugs.includes(finalSlug)) {
    throw new Error(`"${profile.name}" is already in our directory!`);
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
    slug: finalSlug,
    tagline: profile.tagline,
    overview: profile.overview,
    locationCountry: profile.location_country,
    locationRegion: profile.location_region,
    locationLat: profile.location_lat ? parseFloat(profile.location_lat) : null,
    locationLng: profile.location_lng ? parseFloat(profile.location_lng) : null,
    stage: profile.stage,
    population: profile.population,
    foundedYear: profile.founded_year,
    websiteUrl: profile.website_url || url,
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
    isPublished: true,
    isFormingDisclaimer: profile.is_forming_disclaimer || false,
    source: "submission",
    lastResearchedAt: new Date(),
    lastRefreshedAt: new Date(),
  });

  if (profile.tags?.length) {
    await storage.addTags(community.id, profile.tags);
  }

  if (profile.website_url || url) {
    await storage.addLinks(community.id, [
      { url: profile.website_url || url, title: "Official Website", type: "website" },
    ]);
  }

  try {
    await fetchAndStoreImages(community.id, profile.name, profile.website_url || url);
  } catch (imgErr) {
    console.error(`  Image fetch failed for ${profile.name}:`, imgErr);
  }

  console.log(`[submit] Added: ${profile.name} (score: ${solarpunkScore.toFixed(0)}, slug: ${finalSlug})`);

  notifySubscribers({
    name: profile.name,
    slug: finalSlug,
    tagline: profile.tagline,
    locationCountry: profile.location_country,
    locationRegion: profile.location_region,
    solarpunkScore,
    stage: profile.stage,
  }).catch((err) => console.error("[email] notification error:", err));

  return { slug: finalSlug, name: profile.name };
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
  const allCommunities = await storage.getCommunities();
  const existingNames = allCommunities.map((c) => c.name);

  const selectedQueries = DISCOVERY_QUERIES.sort(() => Math.random() - 0.5).slice(0, 5);
  const allResults: any[] = [];

  console.log(`[discovery] Running ${selectedQueries.length} search queries...`);

  for (const query of selectedQueries) {
    try {
      const results = await searchExa(query);
      allResults.push(...results);
      resultsFound += results.length;
      console.log(`  Query "${query.substring(0, 40)}..." returned ${results.length} results`);
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

  console.log(`[discovery] ${uniqueResults.size} unique URLs from ${resultsFound} total results`);
  console.log(`[discovery] Extracting community names (excluding ${existingNames.length} existing)...`);

  const newCommunities = await extractCommunityNames(
    Array.from(uniqueResults.values()),
    existingNames
  );

  console.log(`[discovery] Found ${newCommunities.length} potential new communities`);

  for (const candidate of newCommunities) {
    try {
      const slug = slugify(candidate.name);
      if (existingSlugs.includes(slug)) {
        console.log(`  Skipping "${candidate.name}" - slug already exists`);
        duplicatesSkipped++;
        continue;
      }

      console.log(`  Researching: ${candidate.name}...`);
      const profile = await researchAndProfileCommunity(candidate.name, candidate.sources);
      if (!profile || !profile.name) {
        console.log(`  Could not generate profile for ${candidate.name}`);
        continue;
      }

      const finalSlug = slugify(profile.name);
      if (existingSlugs.includes(finalSlug)) {
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
        slug: finalSlug,
        tagline: profile.tagline,
        overview: profile.overview,
        locationCountry: profile.location_country,
        locationRegion: profile.location_region,
        locationLat: profile.location_lat ? parseFloat(profile.location_lat) : null,
        locationLng: profile.location_lng ? parseFloat(profile.location_lng) : null,
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
        sourcesCount: candidate.sources.length + 5,
        isPublished: true,
        isFormingDisclaimer: profile.is_forming_disclaimer || false,
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

      try {
        await fetchAndStoreImages(community.id, profile.name, profile.website_url);
      } catch (imgErr) {
        console.error(`  Image fetch failed for ${profile.name}:`, imgErr);
      }

      existingSlugs.push(finalSlug);
      existingNames.push(profile.name);
      newCommunitiesAdded++;
      console.log(`  Added: ${profile.name} (score: ${solarpunkScore.toFixed(0)}, confidence: ${profile.ai_confidence})`);

      notifySubscribers({
        name: profile.name,
        slug: finalSlug,
        tagline: profile.tagline,
        locationCountry: profile.location_country,
        locationRegion: profile.location_region,
        solarpunkScore,
        stage: profile.stage,
      }).catch((err) => console.error("[email] notification error:", err));
    } catch (error) {
      errors.push(`Processing failed for ${candidate.name}: ${error}`);
    }
  }

  await db.insert(discoveryRuns).values({
    queriesExecuted: selectedQueries.length,
    resultsFound,
    duplicatesSkipped,
    newCommunitiesAdded,
    errors: errors.length > 0 ? errors : null,
    status: "completed",
  });

  console.log(
    `[discovery] Complete: ${selectedQueries.length} queries, ${resultsFound} results, ${duplicatesSkipped} duplicates, ${newCommunitiesAdded} new communities`
  );

  return {
    queriesExecuted: selectedQueries.length,
    resultsFound,
    duplicatesSkipped,
    newCommunitiesAdded,
    errors,
  };
}
