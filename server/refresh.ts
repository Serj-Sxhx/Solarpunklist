import Anthropic from "@anthropic-ai/sdk";
import { storage } from "./storage";
import { db } from "./db";
import { refreshRuns, communities } from "@shared/schema";
import { eq, lt, sql } from "drizzle-orm";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

async function searchExa(query: string): Promise<any[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) return [];

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
        contents: { text: { maxCharacters: 3000 } },
      }),
    });

    if (!response.ok) return [];
    const data = await response.json();
    return data.results || [];
  } catch {
    return [];
  }
}

async function refreshCommunityProfile(
  name: string,
  existingOverview: string | null,
  freshContext: string
): Promise<any | null> {
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `You are a researcher tracking intentional communities and ecovillages. Given the existing profile and new research, determine what has changed and provide an updated profile.

EXISTING OVERVIEW:
${existingOverview || "No existing overview."}

NEW RESEARCH:
${freshContext}

Return a JSON object with ONLY the fields that should be updated:
{
  "overview": "updated overview if changed, or null",
  "stage": "forming|established|mature|dormant or null if unchanged",
  "population": number or null if unchanged,
  "community_life": "updated text or null",
  "how_to_join": "updated text or null",
  "new_tags": ["any new tags to add"] or [],
  "status_change": "description of what changed" or null,
  "is_dormant": true/false,
  "confidence_adjustment": 0.0-1.0
}

If nothing meaningful has changed, return {"status_change": null, "confidence_adjustment": null}.
Return ONLY valid JSON.`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") return null;

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Refresh LLM error:", error);
    return null;
  }
}

export async function runRefresh(): Promise<{
  communitiesChecked: number;
  contentChangesDetected: number;
  stageChanges: number;
  dormantFlagged: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let contentChangesDetected = 0;
  let stageChanges = 0;
  let dormantFlagged = 0;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const staleEntries = await db
    .select()
    .from(communities)
    .where(eq(communities.isPublished, true));

  const toRefresh = staleEntries.filter((c) => {
    if (!c.lastRefreshedAt) return true;
    return new Date(c.lastRefreshedAt) < thirtyDaysAgo;
  });

  console.log(`[refresh] Found ${toRefresh.length} communities needing refresh out of ${staleEntries.length} total`);

  for (const community of toRefresh) {
    try {
      const searchResults = await searchExa(`${community.name} intentional community ecovillage`);
      const freshContext = searchResults
        .map((r: any) => `Title: ${r.title}\nURL: ${r.url}\nContent: ${r.text || ""}`)
        .join("\n\n---\n\n");

      if (!freshContext) {
        await storage.updateCommunity(community.id, {
          lastRefreshedAt: new Date(),
          refreshCount: (community.refreshCount ?? 0) + 1,
        });
        continue;
      }

      const updates = await refreshCommunityProfile(
        community.name,
        community.overview,
        freshContext
      );

      if (!updates || !updates.status_change) {
        await storage.updateCommunity(community.id, {
          lastRefreshedAt: new Date(),
          refreshCount: (community.refreshCount ?? 0) + 1,
        });
        continue;
      }

      const updateData: any = {
        lastRefreshedAt: new Date(),
        refreshCount: (community.refreshCount ?? 0) + 1,
      };

      if (updates.overview) {
        updateData.overview = updates.overview;
        contentChangesDetected++;
      }
      if (updates.stage && updates.stage !== community.stage) {
        updateData.stage = updates.stage;
        stageChanges++;
      }
      if (updates.is_dormant) {
        updateData.stage = "dormant";
        dormantFlagged++;
      }
      if (updates.population) updateData.population = updates.population;
      if (updates.community_life) updateData.communityLife = updates.community_life;
      if (updates.how_to_join) updateData.howToJoin = updates.how_to_join;
      if (updates.confidence_adjustment) updateData.aiConfidence = updates.confidence_adjustment;

      await storage.updateCommunity(community.id, updateData);

      if (updates.new_tags?.length > 0) {
        await storage.addTags(community.id, updates.new_tags);
      }

      console.log(`  Refreshed: ${community.name} - ${updates.status_change || "minor updates"}`);
    } catch (error) {
      errors.push(`Refresh failed for ${community.name}: ${error}`);
    }
  }

  await db.insert(refreshRuns).values({
    communitiesChecked: toRefresh.length,
    contentChangesDetected,
    stageChanges,
    dormantFlagged,
    errors: errors.length > 0 ? errors : null,
    status: "completed",
  });

  console.log(
    `[refresh] Complete: ${toRefresh.length} checked, ${contentChangesDetected} content changes, ${stageChanges} stage changes, ${dormantFlagged} dormant`
  );

  return {
    communitiesChecked: toRefresh.length,
    contentChangesDetected,
    stageChanges,
    dormantFlagged,
    errors,
  };
}
