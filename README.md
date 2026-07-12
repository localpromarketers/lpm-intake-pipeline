# LPM Intake Pipeline

Client intake → Duda website automation for Local Pro Marketers.

## Stack
- **Frontend:** Next.js 14 (App Router)
- **Database:** Supabase (Postgres + Auth + Storage)
- **AI:** Anthropic Claude API (copy generation)
- **Hosting:** Vercel

## Routes
- `/` — Client start page (select vertical → creates submission)
- `/intake/[token]` — Multi-step intake form (10 steps, auto-save)
- `/admin` — Team dashboard (submission list, detail view, status management)
- `/authority` — **Authority Radar** — AEO/GEO intelligence for home services

## Authority Radar (`/authority`)

Discovers the authority signals AI answer engines (ChatGPT, Claude, Gemini,
Perplexity, Google AI Overviews) use to decide which home-services business to
recommend — and maps a client's path from "shows up once" to "the go-to
recommendation in its category."

Enter a business (name, category, city, optional website + what's already true
about it) and it:
1. Generates the buyer-intent queries real customers ask answer engines
   (best-overall, emergency, transparent-pricing, trust/credentials, etc.).
2. Assesses whether the business would be surfaced — top pick, mentioned, or
   invisible — for each query.
3. Scores the business across **8 weighted authority signals** (review corpus,
   editorial mentions, content authority, citation consistency, credentials,
   structured entity, sentiment differentiators, engagement) into a single
   **Authority Index** and tier (Invisible → Emerging → Contender → Go-To
   Authority).
4. Produces a prioritized roadmap (Quick Win / Foundational / Compounding) to
   raise the index and win the queries that matter.

The signal framework and buyer-query templates live in `lib/authority/`. The
analysis runs on the Anthropic API when `ANTHROPIC_API_KEY` is set (a live
answer-engine probe); without a key it falls back to a deterministic heuristic
so the tool is always demoable (results flagged `estimated`). Runs standalone —
no Supabase tables required.

## Setup
1. Clone repo
2. Copy `.env.local.example` to `.env.local` and fill in your keys
3. `npm install`
4. `npm run dev`

## Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `ANTHROPIC_API_KEY` — For AI copy generation
- `DUDA_API_USER` / `DUDA_API_PASS` — For site automation (Phase 2)
