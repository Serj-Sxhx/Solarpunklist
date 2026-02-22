// Resend integration for email notifications (via Replit connector)
import { Resend } from "resend";
import { storage } from "./storage";

async function getFreshResendClient() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error("X_REPLIT_TOKEN not found for repl/depl");
  }

  const settings = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend",
    {
      headers: {
        Accept: "application/json",
        X_REPLIT_TOKEN: xReplitToken,
      },
    }
  )
    .then((res) => res.json())
    .then((data) => data.items?.[0]);

  if (!settings || !settings.settings.api_key) {
    throw new Error("Resend not connected");
  }

  return {
    client: new Resend(settings.settings.api_key),
    fromEmail: settings.settings.from_email as string,
  };
}

interface CommunityEmailData {
  name: string;
  slug: string;
  tagline?: string | null;
  locationCountry?: string | null;
  locationRegion?: string | null;
  solarpunkScore?: number | null;
  stage?: string | null;
}

function buildAnnouncementHtml(community: CommunityEmailData, baseUrl: string): string {
  const score = Math.round(community.solarpunkScore ?? 0);
  const location = [community.locationRegion, community.locationCountry].filter(Boolean).join(", ");
  const stageLabel = community.stage ? community.stage.charAt(0).toUpperCase() + community.stage.slice(1) : "";
  const profileUrl = `${baseUrl}/community/${community.slug}`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f7f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8e0;">
      
      <div style="background:linear-gradient(135deg,#065f46,#047857);padding:28px 24px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">
          SolarpunkList
        </h1>
        <p style="margin:8px 0 0;color:#a7f3d0;font-size:13px;">
          New Community Discovered
        </p>
      </div>

      <div style="padding:28px 24px;">
        <h2 style="margin:0 0 6px;color:#1a1a1a;font-size:22px;font-weight:700;">
          ${community.name}
        </h2>
        
        ${community.tagline ? `<p style="margin:0 0 16px;color:#555;font-size:14px;line-height:1.5;">${community.tagline}</p>` : ""}

        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          ${location ? `<tr>
            <td style="padding:6px 0;color:#888;font-size:13px;width:100px;">Location</td>
            <td style="padding:6px 0;color:#333;font-size:13px;font-weight:500;">${location}</td>
          </tr>` : ""}
          ${stageLabel ? `<tr>
            <td style="padding:6px 0;color:#888;font-size:13px;width:100px;">Stage</td>
            <td style="padding:6px 0;color:#333;font-size:13px;font-weight:500;">${stageLabel}</td>
          </tr>` : ""}
          <tr>
            <td style="padding:6px 0;color:#888;font-size:13px;width:100px;">Solarpunk Score</td>
            <td style="padding:6px 0;font-size:13px;font-weight:700;color:#047857;">${score} / 100</td>
          </tr>
        </table>

        <div style="text-align:center;margin:24px 0 8px;">
          <a href="${profileUrl}" style="display:inline-block;background:#047857;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
            View Full Profile
          </a>
        </div>
      </div>

      <div style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e2e8e0;text-align:center;">
        <p style="margin:0;color:#999;font-size:11px;">
          You're receiving this because you subscribed to SolarpunkList updates.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function buildAnnouncementText(community: CommunityEmailData, baseUrl: string): string {
  const score = Math.round(community.solarpunkScore ?? 0);
  const location = [community.locationRegion, community.locationCountry].filter(Boolean).join(", ");
  const profileUrl = `${baseUrl}/community/${community.slug}`;

  let text = `New community on SolarpunkList: ${community.name}\n\n`;
  if (community.tagline) text += `${community.tagline}\n\n`;
  if (location) text += `Location: ${location}\n`;
  text += `Solarpunk Score: ${score}/100\n\n`;
  text += `View the full profile: ${profileUrl}\n`;
  return text;
}

export async function notifySubscribers(community: CommunityEmailData): Promise<void> {
  try {
    const emails = await storage.getAllSubscriberEmails();
    if (emails.length === 0) {
      console.log("[email] No subscribers to notify");
      return;
    }

    const { client, fromEmail } = await getFreshResendClient();

    const baseUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPLIT_DEPLOYMENT_URL
        ? `https://${process.env.REPLIT_DEPLOYMENT_URL}`
        : "https://solarpunklist.replit.app";

    const subject = `New on SolarpunkList: ${community.name}`;
    const html = buildAnnouncementHtml(community, baseUrl);
    const text = buildAnnouncementText(community, baseUrl);

    const batchSize = 50;
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map((to) =>
          client.emails.send({
            from: fromEmail,
            to,
            subject,
            html,
            text,
          })
        )
      );

      for (let j = 0; j < results.length; j++) {
        if (results[j].status === "fulfilled") {
          sent++;
        } else {
          failed++;
          console.error(`[email] Failed to send to ${batch[j]}:`, (results[j] as PromiseRejectedResult).reason);
        }
      }
    }

    console.log(`[email] Notified ${sent} subscribers about ${community.name}${failed > 0 ? ` (${failed} failed)` : ""}`);
  } catch (error) {
    console.error("[email] Failed to notify subscribers:", error);
  }
}
