import cron from "node-cron";
import { runDiscovery } from "./discovery";
import { runRefresh } from "./refresh";

export function startScheduler() {
  cron.schedule("0 3 * * 1", async () => {
    console.log("[scheduler] Starting weekly discovery run...");
    try {
      const result = await runDiscovery();
      console.log(`[scheduler] Discovery complete: ${result.newCommunitiesAdded} new communities added`);
    } catch (error) {
      console.error("[scheduler] Discovery run failed:", error);
    }
  });

  cron.schedule("0 4 1 * *", async () => {
    console.log("[scheduler] Starting monthly refresh run...");
    try {
      const result = await runRefresh();
      console.log(`[scheduler] Refresh complete: ${result.communitiesChecked} checked, ${result.contentChangesDetected} changes`);
    } catch (error) {
      console.error("[scheduler] Refresh run failed:", error);
    }
  });

  // Newsletter research: daily at 6 AM UTC — uses CRON_SECRET internally
  cron.schedule("0 6 * * *", async () => {
    console.log("[scheduler] Starting daily newsletter research run...");
    try {
      const { runNewsletterResearch } = await import("./newsletter-research");
      const result = await runNewsletterResearch();
      console.log(`[scheduler] Newsletter research complete: ${result.itemsNew} new items found, ${result.queriesExecuted} queries`);
    } catch (error) {
      console.error("[scheduler] Newsletter research run failed:", error);
    }
  });

  console.log("[scheduler] Weekly discovery (Mon 3AM UTC), monthly refresh (1st 4AM UTC), daily newsletter research (6AM UTC) scheduled");
}
