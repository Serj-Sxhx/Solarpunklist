import Anthropic from "@anthropic-ai/sdk";
import { storage } from "./storage";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

const SUBCATEGORY_QUERIES: Record<string, string[]> = {
  "Solar Microgrids": [
    "community solar microgrid project off-grid",
    "village solar microgrid open source installation",
    "distributed solar power system rural community",
    "solar microgrid energy storage cooperative",
  ],
  "Wind Turbines": [
    "small scale wind turbine community project",
    "open source wind energy DIY turbine",
    "community wind power installation vertical axis",
    "decentralized wind energy rural cooperative",
  ],
  "Rainwater Harvesting": [
    "rainwater harvesting system community design",
    "regenerative water management off-grid collection",
    "community rainwater catchment open source",
    "water harvesting permaculture technology",
  ],
  "Edge AI Compute": [
    "edge AI environmental monitoring agriculture",
    "on-device AI sustainability local inference",
    "edge computing off-grid solar powered AI",
    "AI local compute environmental sensors community",
  ],
  "Permaculture Design": [
    "permaculture design technology breakthrough",
    "food forest IoT monitoring regenerative agriculture",
    "permaculture open source design tools",
    "regenerative agriculture technology innovation",
  ],
  "Battery Storage": [
    "community battery storage off-grid energy",
    "open source battery management system DIY",
    "iron air battery community storage",
    "second life EV battery community microgrid",
  ],
  "LoRa / Mesh Networks": [
    "LoRaWAN community network off-grid internet",
    "mesh network decentralized rural connectivity",
    "Meshtastic community deployment LoRa",
    "decentralized internet rural LoRa sensor network",
  ],
  "CNC & 3D Printing": [
    "3D printed sustainable housing community",
    "open source CNC fabrication distributed manufacturing",
    "3D printing regenerative community tools",
    "distributed manufacturing local production community",
  ],
  "Autonomous Drones": [
    "drone reforestation autonomous planting",
    "agricultural drone autonomous community",
    "conservation drone monitoring ecology",
    "seed planting drone reforestation project",
  ],
  "IoT Sensor Arrays": [
    "IoT soil monitoring open source agriculture",
    "environmental sensor network community",
    "smart farm sensor array LoRa agriculture",
    "open source IoT environmental monitoring",
  ],
};

const TRL_SCALE = `
Technology Readiness Levels:
TRL 1 - Basic Principles Observed: Theoretical research, papers, no working implementation
TRL 2 - Technology Concept Formulated: Practical application hypothesized
TRL 3 - Experimental Proof of Concept: Lab validation of individual elements
TRL 4 - Lab Validation: Components integrated, low-fidelity prototype in lab
TRL 5 - Relevant Environment Validation: Tested in simulated or partially real conditions
TRL 6 - Prototype Demo: High-fidelity prototype in relevant environment
TRL 7 - Operational Prototype: Near-final system in real environment field trial
TRL 8 - System Qualified: Proven to work in final form, certified
TRL 9 - Proven Deployment: Fully operational in real mission or commercial use for 1+ years
`;

const FRONTIER_GUIDANCE = `
Frontier Score (0-1) measures novelty and paradigm-shifting potential:
- High (0.8-1.0): First-of-its-kind at any TRL. TRL 1-3 paper on something nobody's tried. TRL 7 deployment breaking a long-standing barrier. Unexpected field crossovers.
- Medium (0.4-0.7): Meaningful advancement within a known field. New open-source implementation. Notable scale-up or cost reduction.
- Low (0.0-0.3): Incremental improvement. Known tech deployed in a new location. Another solar farm goes online.
`;

const CANONICAL_SUBCATEGORIES = Object.keys(SUBCATEGORY_QUERIES);

async function searchExa(query: string): Promise<any[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    console.warn("[newsletter-research] EXA_API_KEY not set, skipping search");
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
        numResults: 5,
        useAutoprompt: false,
        contents: {
          text: { maxCharacters: 3000 },
        },
      }),
    });

    if (!response.ok) {
      console.error(`[newsletter-research] Exa search failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("[newsletter-research] Exa search error:", error);
    return [];
  }
}

async function enrichItemWithClaude(item: {
  title: string;
  url: string;
  text: string;
  publishedDate?: string;
}): Promise<{
  summary: string;
  subcategoryTags: string[];
  tags: string[];
  relevanceScore: number;
  trlLevel: number;
  trlReasoning: string;
  frontierScore: number;
} | null> {
  const truncatedText = (item.text || "").substring(0, 2500);

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 600,
      system: `You are an expert analyst of solarpunk and regenerative technology. Analyze articles and rate them on relevance, technology readiness, and frontier novelty.

${TRL_SCALE}

${FRONTIER_GUIDANCE}

Canonical subcategory tags (use only these, can assign multiple):
${CANONICAL_SUBCATEGORIES.join(", ")}

Return ONLY a JSON object, no markdown, no explanation.`,
      messages: [
        {
          role: "user",
          content: `Analyze this article about solarpunk/regenerative technology:

Title: ${item.title}
URL: ${item.url}
Content: ${truncatedText}

Return JSON:
{
  "summary": "2-3 sentence summary of what this technology does and why it matters for solarpunk communities",
  "subcategoryTags": ["array of 1-3 canonical subcategory tags that apply"],
  "tags": ["2-4 freeform tags like open-source, DIY, community-scale, etc"],
  "relevanceScore": 0.0-1.0,
  "trlLevel": 1-9,
  "trlReasoning": "one sentence explaining the TRL rating based on evidence in article",
  "frontierScore": 0.0-1.0
}`,
        },
      ],
    });

    const text = response.content[0];
    if (text.type !== "text") return null;

    const match = text.text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]);

    return {
      summary: String(parsed.summary || "").substring(0, 1000),
      subcategoryTags: Array.isArray(parsed.subcategoryTags)
        ? parsed.subcategoryTags.filter((t: any) => CANONICAL_SUBCATEGORIES.includes(t)).slice(0, 3)
        : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5).map(String) : [],
      relevanceScore: Math.min(1, Math.max(0, Number(parsed.relevanceScore) || 0)),
      trlLevel: Math.min(9, Math.max(1, Math.round(Number(parsed.trlLevel) || 1))),
      trlReasoning: String(parsed.trlReasoning || "").substring(0, 300),
      frontierScore: Math.min(1, Math.max(0, Number(parsed.frontierScore) || 0)),
    };
  } catch (error) {
    console.error("[newsletter-research] Claude enrichment error:", error);
    return null;
  }
}

export async function runNewsletterResearch(): Promise<{
  itemsFound: number;
  itemsNew: number;
  itemsDuplicate: number;
  queriesExecuted: number;
  errors: string[];
}> {
  const run = await storage.createNewsletterResearchRun();
  const errors: string[] = [];
  let itemsFound = 0;
  let itemsNew = 0;
  let itemsDuplicate = 0;
  let queriesExecuted = 0;

  const existingUrls = await storage.getExistingNewsletterSourceUrls();
  const newItemsThisRun: { id: string; frontierScore: number }[] = [];

  for (const [subcategory, queryPool] of Object.entries(SUBCATEGORY_QUERIES)) {
    const queryIndex = new Date().getDay() % queryPool.length;
    const query = queryPool[queryIndex];

    console.log(`[newsletter-research] Searching: "${query}" (${subcategory})`);
    const results = await searchExa(query);
    queriesExecuted++;
    itemsFound += results.length;

    for (const result of results) {
      const url = result.url;
      if (!url) continue;

      if (existingUrls.has(url)) {
        itemsDuplicate++;
        continue;
      }

      existingUrls.add(url);

      try {
        const enriched = await enrichItemWithClaude({
          title: result.title || url,
          url,
          text: result.text || "",
          publishedDate: result.publishedDate,
        });

        if (!enriched || enriched.relevanceScore < 0.3) {
          console.log(`[newsletter-research] Skipping low-relevance item: ${url} (score: ${enriched?.relevanceScore ?? 0})`);
          continue;
        }

        const sourceDomain = (() => {
          try { return new URL(url).hostname.replace("www.", ""); }
          catch { return ""; }
        })();

        const publishedAt = result.publishedDate ? new Date(result.publishedDate) : undefined;

        const item = await storage.createNewsletterItem({
          researchRunId: run.id,
          title: (result.title || url).substring(0, 500),
          summary: enriched.summary,
          sourceUrl: url,
          sourceDomain,
          publishedAt: publishedAt ?? null,
          subcategoryTags: enriched.subcategoryTags.length > 0 ? enriched.subcategoryTags : [subcategory],
          tags: enriched.tags,
          relevanceScore: enriched.relevanceScore,
          trlLevel: enriched.trlLevel,
          trlReasoning: enriched.trlReasoning,
          frontierScore: enriched.frontierScore,
          isFrontier: false,
          imageUrl: result.image || null,
          isSelected: false,
        });

        if (item) {
          newItemsThisRun.push({ id: item.id, frontierScore: enriched.frontierScore });
          itemsNew++;
          console.log(`[newsletter-research] Saved: ${result.title} (TRL ${enriched.trlLevel}, frontier: ${enriched.frontierScore.toFixed(2)})`);
        }
      } catch (err: any) {
        const msg = `Error processing ${url}: ${err?.message}`;
        console.error("[newsletter-research]", msg);
        errors.push(msg);
      }
    }
  }

  // Auto-star top 3-5 items by frontier score
  const starCount = newItemsThisRun.length >= 10 ? 5 : 3;
  const topItems = [...newItemsThisRun]
    .sort((a, b) => b.frontierScore - a.frontierScore)
    .slice(0, starCount);

  for (const item of topItems) {
    await storage.updateNewsletterItem(item.id, { isFrontier: true });
  }

  await storage.updateNewsletterResearchRun(run.id, {
    queriesExecuted,
    itemsFound,
    itemsNew,
    itemsDuplicate,
    errors: errors.length > 0 ? errors : null,
  });

  console.log(`[newsletter-research] Run complete: ${itemsNew} new, ${itemsDuplicate} duplicates, ${topItems.length} frontier-starred`);

  return { itemsFound, itemsNew, itemsDuplicate, queriesExecuted, errors };
}
