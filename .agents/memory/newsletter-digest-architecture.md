---
name: SolarpunkDigest newsletter architecture
description: Key decisions and constraints for the newsletter research+digest pipeline
---

## issueNumber is DB-auto-generated
`newsletterDigestIssues.issueNumber` is a `serial()` column — it's omitted from `insertNewsletterDigestIssueSchema`. Never pass it to `createNewsletterDigestIssue()`.

## Unsubscribe token interpolation
`sendDigest()` uses string replacement on the generated HTML: replaces `UNSUBSCRIBE_TOKEN` placeholder with each subscriber's real token at send time. Don't change the placeholder string without updating both `generateDigest()` and `sendDigest()`.

## Claude model split
- Newsletter item enrichment: `claude-haiku-4-5` (cheap, fast, 600 tokens)
- Digest narrative generation: `claude-sonnet-4-5` (higher quality, 4000 tokens)

**Why:** Research runs dozens of items per session; using Haiku keeps costs manageable. Digest is one call per issue so quality matters more.

## Research dedup pattern
`getExistingNewsletterSourceUrls()` returns a Set of all known URLs. Within a run, a local Set is also maintained to prevent intra-run duplication before DB commit.

## isSelected / isFrontier are nullable booleans in schema
Use `=== true` for comparisons in frontend, never truthy checks, to handle `null` safely.

## Admin workflow (6 steps)
1. Run Research → discovers items
2. Star ⚡ frontier items (auto-starred: top 3-5 by frontierScore)
3. ✓ Select items for the digest
4. Create new issue (links currently selected + unassigned items)
5. Generate digest (Claude Sonnet → HTML/Markdown)
6. Send to all active subscribers (Resend batched)
