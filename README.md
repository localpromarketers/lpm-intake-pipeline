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

The signal model is grounded in **SEER** (Schieler DeLand / Relationalseo): its
**12 classifier categories**, **9 diagnostic OS tools**, and **205 named
classifiers** are captured as data in `lib/authority/seer-taxonomy.js`. Those
12 categories ARE Authority Radar's signals, so the tool speaks SEER's language
end-to-end.

Enter a business (name, category, city, optional website + what's already true
about it) and it:
1. Generates the buyer-intent queries real customers ask answer engines
   (best-overall, emergency, transparent-pricing, trust/credentials, etc.).
2. Assesses whether the business would be surfaced — top pick, mentioned, or
   invisible — for each query.
3. Scores the business across the **12 weighted authority signals** (Identity &
   Entity, Local & Spatial, Trust & Credentials, Content Utility, Linguistic
   Authenticity, Visual Intelligence, External Reputation, Link Authority,
   Technical Infra, Integrity Risk, Behavioral Validation, Temporal Dynamics)
   into a single **Authority Index** and tier (Invisible → Emerging → Contender
   → Go-To Authority). Each signal shows how many SEER classifiers feed it.
4. Produces a prioritized roadmap (Quick Win / Foundational / Compounding) to
   raise the index and win the queries that matter.

The framework and buyer-query templates live in `lib/authority/`. The analysis
runs on the Anthropic API when `ANTHROPIC_API_KEY` is set (a live answer-engine
probe); without a key it falls back to a deterministic heuristic so the tool is
always demoable (results flagged `estimated`). Runs standalone — no Supabase
tables required.

### SEER import (Relationalseo)

Where the engine *estimates* signal scores, SEER provides *measured* data. Paste
a SEER export into the "Import SEER data" panel on `/authority` (or POST a
`seerData` field to the scan API). SEER can report at three granularities and
the importer rolls **any mix** of them up into the 12 signals + the Authority
Index:

- **OS-tool scores** — `{ "tools": { "EntityOS": 72, "GBPOS": { "score": 80 } } }`.
  A tool's score is distributed across the categories it diagnoses, weighted by
  how many of that category's classifiers the tool evaluates (derived from the
  taxonomy, so it can't drift).
- **Category scores** — `{ "categories": { "local_spatial": 66 } }` (direct).
- **Classifier scores** — `{ "classifiers": { "review_velocity": 42 } }`, rolled
  into that classifier's category.
- **Weights** — `{ "weights": { "external_reputation": 15 } }` recalibrates the
  index (renormalized to sum 100).

SEER's measured data **overrides** the engine's estimate for every signal it
covers (tagged `SEER` in the report); uncovered signals keep the engine's
read-out. `CompetitorScope` / `SERP Overlap` / `ChatGPT-OS` are accepted as
context (not scored). Unrecognized fields are reported as warnings, never
guessed. Full shape in `lib/authority/seer.js` (`SEER_SCHEMA_DOC`) and
`docs/seer-import-example.json`.

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
