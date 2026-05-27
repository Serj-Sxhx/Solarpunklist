import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { storage } from "./storage";
import type { NewsletterItem } from "@shared/schema";

interface FeaturedCommunity {
  name: string;
  slug: string;
  tagline: string | null;
  location: string | null;
  heroImageUrl: string | null;
  solarpunkScore: number | null;
  stage: string | null;
}

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

async function getFreshResendClient() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) throw new Error("Replit token not found");

  const settings = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend",
    {
      headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken },
    }
  )
    .then((r) => r.json())
    .then((d) => d.items?.[0]);

  if (!settings?.settings?.api_key) throw new Error("Resend connector not configured");

  return {
    client: new Resend(settings.settings.api_key),
    fromEmail: settings.settings.from_email as string,
  };
}

interface DigestSection {
  subcategory: string;
  items: {
    headline: string;
    trlLabel: string;
    blurb: string;
    tags: string[];
    sourceUrl: string;
    sourceDomain: string;
    imageUrl?: string | null;
    isFrontier: boolean;
  }[];
}

interface DigestJson {
  subject: string;
  introText: string;
  sections: DigestSection[];
}

async function generateDigestJson(items: NewsletterItem[]): Promise<DigestJson> {
  const itemDescriptions = items.map((item, i) => ({
    index: i + 1,
    title: item.title,
    summary: item.summary,
    sourceUrl: item.sourceUrl,
    sourceDomain: item.sourceDomain,
    subcategoryTags: item.subcategoryTags,
    tags: item.tags,
    trlLevel: item.trlLevel,
    frontierScore: item.frontierScore,
    isFrontier: item.isFrontier,
    imageUrl: item.imageUrl,
  }));

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4000,
    system: `You are writing SolarpunkDigest, a weekly newsletter about breakthroughs in solarpunk technology. 
Write in a warm, optimistic but grounded tone. Not corporate. Not breathless hype. Like a smart friend sharing what they found this week.
Return ONLY valid JSON, no markdown fences, no explanation.`,
    messages: [
      {
        role: "user",
        content: `Generate a newsletter digest for these ${items.length} curated solarpunk tech items:

${JSON.stringify(itemDescriptions, null, 2)}

Return this exact JSON structure:
{
  "subject": "compelling email subject line (specific, not clickbait, mentions the theme of this issue)",
  "introText": "3-4 sentences setting up this week's theme and what readers will find inside",
  "sections": [
    {
      "subcategory": "subcategory name",
      "items": [
        {
          "headline": "compelling headline (can differ from source title)",
          "trlLabel": "TRL N — Description (e.g. TRL 3 — Proof of Concept)",
          "blurb": "2-3 editorial sentences. If isFrontier is true, lead with a breakthrough framing. Add context on why this matters for the solarpunk movement.",
          "tags": ["tag1", "tag2"],
          "sourceUrl": "original source URL",
          "sourceDomain": "domain.com",
          "imageUrl": null or "url",
          "isFrontier": true or false
        }
      ]
    }
  ]
}

Rules:
- Group items by their primary subcategoryTag into sections
- Within each section, put isFrontier items first
- Keep the tone warm, optimistic, grounded
- trlLabel format: "TRL N — Short Description" using the TRL levels: 1=Basic Research, 2=Concept, 3=Proof of Concept, 4=Lab Validation, 5=Environment Validation, 6=Prototype Demo, 7=Operational Prototype, 8=System Qualified, 9=Proven Deployment`,
      },
    ],
  });

  const text = response.content[0];
  if (text.type !== "text") throw new Error("Claude returned non-text response");

  const match = text.text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Claude response contained no valid JSON");

  return JSON.parse(match[0]) as DigestJson;
}

function getTrlColor(trlLevel: number | null): string {
  if (!trlLevel) return "#6b7280";
  if (trlLevel <= 3) return "#3b82f6";
  if (trlLevel <= 6) return "#f59e0b";
  return "#10b981";
}

/** Escape HTML special characters to prevent XSS injection via AI-generated content. */
function esc(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Only allow http/https URLs — rejects javascript: and data: schemes. */
function safeUrl(url: string | null | undefined): string {
  if (!url) return "#";
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return url;
  } catch {
    // malformed URL
  }
  return "#";
}

function renderFeaturedCommunityHtml(community: FeaturedCommunity, baseUrl: string): string {
  const communityUrl = `${baseUrl}/community/${community.slug}`;
  const scoreDisplay = community.solarpunkScore != null
    ? `<span style="display:inline-block;background:#a7d4b5;color:#1a3a2a;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;margin-right:6px;">🌱 Score ${community.solarpunkScore}</span>`
    : "";
  const stageDisplay = community.stage
    ? `<span style="display:inline-block;background:rgba(255,255,255,0.15);color:#e8f5e9;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;margin-right:6px;">${esc(community.stage)}</span>`
    : "";
  const locationDisplay = community.location
    ? `<p style="margin:0 0 12px;color:#a7d4b5;font-size:13px;">📍 ${esc(community.location)}</p>`
    : "";
  const heroImg = community.heroImageUrl
    ? `<img src="${esc(safeUrl(community.heroImageUrl))}" alt="${esc(community.name)}" style="width:100%;height:180px;object-fit:cover;border-radius:8px;margin-bottom:16px;display:block;" />`
    : `<div style="width:100%;height:100px;background:linear-gradient(135deg,#1a3a2a,#2d5a3d);border-radius:8px;margin-bottom:16px;display:flex;align-items:center;justify-content:center;"><span style="font-size:36px;">🌿</span></div>`;

  return `
    <tr>
      <td style="padding:0 24px 8px;">
        <div style="background:linear-gradient(135deg,#1a3a2a,#2d5a3d);border-radius:12px;padding:24px;margin-top:8px;">
          <p style="margin:0 0 14px;color:#a7d4b5;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">🌿 Featured Community from the Directory</p>
          ${heroImg}
          <h3 style="margin:0 0 6px;color:#ffffff;font-size:18px;font-weight:800;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${esc(community.name)}</h3>
          ${locationDisplay}
          ${community.tagline ? `<p style="margin:0 0 14px;color:#d4edd9;font-size:14px;line-height:1.6;">${esc(community.tagline)}</p>` : ""}
          <div style="margin-bottom:16px;">${scoreDisplay}${stageDisplay}</div>
          <a href="${esc(safeUrl(communityUrl))}" style="display:inline-block;background:#4a7c59;color:#ffffff;font-size:13px;font-weight:700;padding:10px 20px;border-radius:8px;text-decoration:none;">Explore Community →</a>
        </div>
      </td>
    </tr>`;
}

function renderDigestHtml(digest: DigestJson, unsubscribeUrl: string, featuredCommunity?: FeaturedCommunity, baseUrl?: string): string {
  const sectionsHtml = digest.sections
    .map(
      (section) => `
    <tr>
      <td style="padding:0 24px;">
        <h2 style="margin:32px 0 16px;font-size:18px;font-weight:700;color:#8b6914;border-bottom:2px solid #fef3c7;padding-bottom:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          ${esc(section.subcategory)}
        </h2>
        ${section.items
          .map(
            (item) => `
        <div style="margin-bottom:28px;padding:20px;background:#fafaf8;border-radius:10px;border:1px solid #e8e4d8;">
          ${item.isFrontier ? `<div style="margin-bottom:10px;"><span style="display:inline-block;background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:0.05em;">⚡ FRONTIER DISCOVERY</span></div>` : ""}
          ${item.imageUrl ? `<img src="${esc(safeUrl(item.imageUrl))}" alt="${esc(item.headline)}" style="width:100%;max-height:200px;object-fit:cover;border-radius:8px;margin-bottom:14px;" />` : ""}
          <h3 style="margin:0 0 8px;font-size:16px;font-weight:700;color:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <a href="${esc(safeUrl(item.sourceUrl))}" style="color:#1a1a1a;text-decoration:none;">${esc(item.headline)}</a>
          </h3>
          <div style="margin-bottom:10px;">
            <span style="display:inline-block;background:${getTrlColor(parseInt(item.trlLabel.match(/TRL (\d)/)?.[1] || "0"))};color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:12px;margin-right:6px;">${esc(item.trlLabel)}</span>
            ${item.tags.slice(0, 3).map((tag) => `<span style="display:inline-block;background:#ecfdf5;color:#065f46;font-size:10px;font-weight:600;padding:2px 8px;border-radius:12px;margin-right:4px;">${esc(tag)}</span>`).join("")}
          </div>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#444;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${esc(item.blurb)}</p>
          <p style="margin:0;font-size:12px;color:#888;">
            <a href="${esc(safeUrl(item.sourceUrl))}" style="color:#4a7c59;text-decoration:none;font-weight:600;">Read more → ${esc(item.sourceDomain)}</a>
          </p>
        </div>`
          )
          .join("")}
      </td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(digest.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f3ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e0dbd0;">

      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#2d5a3d,#4a7c59);padding:32px 24px;text-align:center;">
          <h1 style="margin:0 0 4px;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">🌿 SolarpunkDigest</h1>
          <p style="margin:0;color:#a7d4b5;font-size:13px;letter-spacing:0.05em;">WEEKLY TECH BREAKTHROUGHS</p>
        </td>
      </tr>

      <!-- Intro -->
      <tr>
        <td style="padding:28px 24px 8px;">
          <p style="margin:0;font-size:15px;line-height:1.7;color:#333;">${esc(digest.introText)}</p>
        </td>
      </tr>

      <!-- Sections -->
      ${sectionsHtml}

      <!-- Featured Community -->
      ${featuredCommunity ? renderFeaturedCommunityHtml(featuredCommunity, baseUrl || "https://solarpunklist.com") : ""}

      <!-- Footer -->
      <tr>
        <td style="padding:24px;background:#f0ede6;border-top:1px solid #e0dbd0;text-align:center;">
          <p style="margin:0 0 8px;color:#888;font-size:12px;">
            You're receiving this because you subscribed to SolarpunkDigest.
          </p>
          <p style="margin:0;font-size:12px;">
            <a href="${esc(safeUrl(unsubscribeUrl))}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
            &nbsp;·&nbsp;
            <a href="${esc(safeUrl(baseUrl || "https://solarpunklist.com"))}" style="color:#4a7c59;text-decoration:none;font-weight:600;">Powered by SolarpunkList</a>
          </p>
        </td>
      </tr>

    </table>
  </div>
</body>
</html>`;
}

function renderDigestMarkdown(digest: DigestJson): string {
  let md = `# ${digest.subject}\n\n${digest.introText}\n\n`;
  for (const section of digest.sections) {
    md += `## ${section.subcategory}\n\n`;
    for (const item of section.items) {
      md += `${item.isFrontier ? "⚡ " : ""}**${item.headline}** — ${item.trlLabel}\n\n`;
      md += `${item.blurb}\n\n`;
      md += `Tags: ${item.tags.join(", ")} | [Read more](${item.sourceUrl})\n\n`;
    }
  }
  return md;
}

export async function generateDigest(issueId: string): Promise<void> {
  const issue = await storage.getNewsletterDigestIssue(issueId);
  if (!issue) throw new Error(`Issue ${issueId} not found`);

  const selectedItems = issue.items.filter((item) => item.isSelected === true);
  if (selectedItems.length === 0) throw new Error("No selected items to generate digest from");

  console.log(`[newsletter-digest] Generating digest for issue ${issueId} with ${selectedItems.length} items`);

  const digestJson = await generateDigestJson(selectedItems);

  const baseUrl =
    process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "https://solarpunklist.com";

  // Pick a random published community to feature at the bottom
  let featuredCommunity: FeaturedCommunity | undefined;
  try {
    const allCommunities = await storage.getCommunities();
    const published = allCommunities.filter((c) => c.isPublished);
    if (published.length > 0) {
      const pick = published[Math.floor(Math.random() * published.length)];
      featuredCommunity = {
        name: pick.name,
        slug: pick.slug,
        tagline: pick.tagline ?? null,
        location: pick.location ?? null,
        heroImageUrl: pick.heroImageUrl ?? null,
        solarpunkScore: pick.solarpunkScore ?? null,
        stage: pick.stage ?? null,
      };
      console.log(`[newsletter-digest] Featured community: ${featuredCommunity.name}`);
    }
  } catch (err) {
    console.warn("[newsletter-digest] Could not fetch featured community:", err);
  }

  // Use a placeholder token — real token is interpolated per-subscriber at send time
  const placeholderUnsubUrl = `${baseUrl}/api/newsletter/unsubscribe?token=UNSUBSCRIBE_TOKEN`;
  const generatedHtml = renderDigestHtml(digestJson, placeholderUnsubUrl, featuredCommunity, baseUrl);
  const generatedMarkdown = renderDigestMarkdown(digestJson);

  await storage.updateNewsletterDigestIssue(issueId, {
    subject: digestJson.subject,
    introText: digestJson.introText,
    generatedHtml,
    generatedMarkdown,
    status: "generated",
  });

  console.log(`[newsletter-digest] Digest generated for issue ${issueId}: "${digestJson.subject}"`);
}

export async function sendDigest(issueId: string): Promise<{ recipientCount: number }> {
  const issue = await storage.getNewsletterDigestIssue(issueId);
  if (!issue) throw new Error(`Issue ${issueId} not found`);
  if (!issue.generatedHtml) throw new Error("Issue has no generated HTML — generate digest first");

  const subscribers = await storage.listActiveSubscribers();
  if (subscribers.length === 0) throw new Error("No active subscribers to send to");

  const { client, fromEmail } = await getFreshResendClient();

  const baseUrl =
    process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "https://solarpunklist.com";

  const subject = issue.subject || "SolarpunkDigest — Weekly Solarpunk Tech Roundup";
  const batchSize = 50;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < subscribers.length; i += batchSize) {
    const batch = subscribers.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map((subscriber) => {
        // generatedHtml already contains an absolute URL like:
        //   https://<host>/api/newsletter/unsubscribe?token=UNSUBSCRIBE_TOKEN
        // Just replace the placeholder token — never touch the URL structure.
        const personalizedHtml = issue.generatedHtml!.replace(
          /UNSUBSCRIBE_TOKEN/g,
          encodeURIComponent(subscriber.unsubscribeToken || "")
        );

        return client.emails.send({
          from: process.env.DIGEST_FROM_EMAIL || fromEmail,
          to: subscriber.email,
          subject,
          html: personalizedHtml,
        });
      })
    );

    for (let j = 0; j < results.length; j++) {
      if (results[j].status === "fulfilled") {
        sent++;
      } else {
        failed++;
        console.error(
          `[newsletter-digest] Failed to send to ${batch[j].email}:`,
          (results[j] as PromiseRejectedResult).reason
        );
      }
    }
  }

  await storage.updateNewsletterDigestIssue(issueId, {
    status: "sent",
    sentAt: new Date(),
    recipientCount: sent,
  });

  console.log(`[newsletter-digest] Sent issue ${issueId} to ${sent} subscribers${failed > 0 ? ` (${failed} failed)` : ""}`);

  return { recipientCount: sent };
}
