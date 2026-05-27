---
name: SolarpunkDigest newsletter architecture
description: Key decisions and constraints for the newsletter research+digest pipeline
---

## issueNumber is DB-auto-generated
`newsletterDigestIssues.issueNumber` is a `serial()` column — it's omitted from `insertNewsletterDigestIssueSchema`. Never pass it to `createNewsletterDigestIssue()`.

## Auth model: CRON_SECRET Bearer token
- `POST /api/cron/research` — requires Bearer CRON_SECRET (external scheduler)
- `POST /api/newsletter/issues/:id/send` — requires Bearer CRON_SECRET (mass email protection)
- All other newsletter admin routes — UI-gated only (no V1 server auth)
- Admin UI has a CRON_SECRET input field so admins can authorize sending from browser

**Why:** V1 has no user authentication. CRON_SECRET protects the two highest-impact endpoints.

## Route namespace
All newsletter endpoints live under `/api/newsletter/*`. Special cron: `POST /api/cron/research`. NOT `/api/admin/newsletter/*`.

## Unsubscribe token interpolation
`sendDigest()` interpolates each subscriber's token at send time by replacing `UNSUBSCRIBE_TOKEN` placeholder in generated HTML. Don't change the placeholder without updating both files.

## Daily research schedule
Cron: `0 6 * * *` (6AM UTC daily). Manual trigger: `POST /api/newsletter/research` (no auth, admin UI).

## isSelected / isFrontier are nullable booleans in schema
Use `=== true` for comparisons in frontend to handle `null` safely.

## Admin workflow (6 steps)
1. Run Research → discovers items via Exa + Claude Haiku
2. Star ⚡ frontier items (auto-starred: top 3-5 by frontierScore)
3. ✓ Select items for the digest
4. Click 'Generate Digest' → Claude Sonnet writes newsletter copy
5. Edit subject & intro inline in digest detail view; preview in iframe
6. Enter CRON_SECRET + Send to all active subscribers (Resend batched 50/batch)
