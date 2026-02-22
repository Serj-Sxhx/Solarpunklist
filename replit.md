# SolarpunkList

## Overview

SolarpunkList is a web directory of solarpunk intentional communities and regenerative land projects — think "Nomad List for ecovillages." It features an AI-powered discovery pipeline that uses semantic web search (Exa API) and LLM analysis (Anthropic Claude) to automatically find, profile, and score communities based on sustainability dimensions (energy, land, tech, governance, community, circularity). The directory presents rich community profiles with filterable/sortable cards, detailed pages with score breakdowns, tech stacks, and joining information.

No user authentication in V1. The app is a public-facing directory with an admin discovery endpoint.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework:** React 18 with Vite (not Next.js — despite the original spec mentioning Next.js, the implementation uses Vite + Express)
- **Routing:** Wouter (lightweight client-side router)
- **State/Data Fetching:** TanStack React Query with a custom `apiRequest` helper and `getQueryFn` factory
- **UI Components:** shadcn/ui (new-york style) with Radix UI primitives, Tailwind CSS, class-variance-authority
- **Fonts:** Nunito (body/headings) and Lora (serif accent), loaded via Google Fonts
- **Pages:** DirectoryPage (filterable grid), CommunityDetailPage (full profile), AboutPage, NotFound
- **Path aliases:** `@/` → `client/src/`, `@shared/` → `shared/`, `@assets/` → `attached_assets/`

### Backend
- **Framework:** Express.js running on Node with tsx (TypeScript execution)
- **Architecture:** Single Express server serves both the API and the Vite dev server (in development) or static built files (in production)
- **API Design:** RESTful JSON endpoints under `/api/` prefix
  - `GET /api/communities` — list all published communities with relations
  - `GET /api/communities/:slug` — single community detail
  - `GET /api/stats` — total community count
  - `POST /api/admin/discover` — trigger AI discovery pipeline
  - Chat/conversation endpoints under `/api/conversations`
- **Build:** Custom build script (`script/build.ts`) using Vite for client and esbuild for server, outputting to `dist/`

### Database
- **Database:** PostgreSQL (required, connection via `DATABASE_URL` environment variable)
- **ORM:** Drizzle ORM with `drizzle-zod` for schema validation
- **Schema location:** `shared/schema.ts` (shared between client and server)
- **Migration tool:** Drizzle Kit (`drizzle-kit push` via `npm run db:push`)
- **Key tables:**
  - `communities` — main entity with name, slug, location, scores, tech stack (JSONB), markdown content fields
  - `community_tags` — tags associated with communities
  - `community_links` — external links per community
  - `community_images` — images per community
  - `discovery_runs` — tracking discovery pipeline executions
  - `refresh_runs` — tracking refresh pipeline executions
  - `conversations` / `messages` — chat integration tables
- **Session store:** connect-pg-simple (PostgreSQL-backed sessions)
- **Storage pattern:** `IStorage` interface implemented by `DatabaseStorage` class, accessed via singleton `storage` export

### AI Discovery Pipeline
- **Search:** Exa API (semantic/neural web search) to discover communities matching solarpunk-related queries
- **LLM Processing:** Anthropic Claude (via `@anthropic-ai/sdk`) to analyze search results and generate structured community profiles
- **Scheduling:** node-cron runs weekly discovery (Mondays at 3 AM UTC) and monthly refresh (1st of month at 4 AM UTC)
- **Refresh Pipeline:** `server/refresh.ts` re-researches existing communities monthly via Exa + Claude to detect changes, dormancy, stage transitions
- **Seed Data:** `server/seed.ts` contains hardcoded initial communities for bootstrapping
- **Image Pipeline:** `server/image-fetcher.ts` uses Exa API to find real photos from community websites and web search results. Images are validated via HEAD request (content-type + minimum size), filtered against known bad patterns (logos, icons, GIFs, placeholders), and stored in `community_images` table. Backfill endpoint: `POST /api/admin/backfill-images`.

### Image Fallback System
- **AI-generated fallback images** for every community are stored at `client/public/images/communities/{slug}.png`
- **Frontend fallback:** Both CommunityCard and CommunityDetailPage use `onError` handlers on `<img>` tags to swap to `/images/communities/{slug}.png` if external hero images fail to load
- **Hero image selection:** During discovery, the first verified image becomes `heroImageUrl`. If no verified images are found, the frontend automatically falls back to the AI-generated image via the slug-based path convention
- **Photo gallery:** Detail pages display all community images in a grid with lightbox. Gallery images that fail to load are hidden individually

### Scoring System
Communities are scored on a 0-100 "Solarpunk Score" composed of six dimensions (each 0-10):
- Energy, Land, Tech, Governance, Community, Circularity

### Replit Integrations
- `server/replit_integrations/chat/` — Chat functionality with Anthropic Claude
- `server/replit_integrations/batch/` — Batch processing utilities for Anthropic API calls
- Vite plugins: `@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner`

## External Dependencies

### Required Services
- **PostgreSQL Database** — Primary data store. Must set `DATABASE_URL` environment variable. Provisioned via Replit's database service.
- **Anthropic Claude API** — Used for AI-powered community profile generation and chat. Requires `AI_INTEGRATIONS_ANTHROPIC_API_KEY` and `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` environment variables.
- **Exa Search API** — Semantic web search for discovering new communities. Requires `EXA_API_KEY` environment variable. Optional — discovery degrades gracefully without it.

### Key NPM Packages
- `drizzle-orm` + `drizzle-kit` — Database ORM and migrations
- `@anthropic-ai/sdk` — Anthropic Claude integration
- `express` + `express-session` — HTTP server and sessions
- `connect-pg-simple` — PostgreSQL session store
- `node-cron` — Scheduled task execution
- `@tanstack/react-query` — Client-side data fetching
- `wouter` — Client-side routing
- `zod` + `drizzle-zod` — Runtime schema validation
- `p-limit` + `p-retry` — Concurrency and retry control for API calls
- Full shadcn/ui component library (Radix UI primitives)