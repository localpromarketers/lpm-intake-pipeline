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
- `/tasks` — Conversation task scanner (see below)

## Conversation task scanner
Turns your Claude conversations into one deduplicated to-do list across every
project. Drop a Claude data export at `/tasks`, or run it from the terminal:

```bash
npm run scan -- ~/Downloads/claude-export --dry-run   # estimate, spend nothing
npm run scan -- ~/Downloads/claude-export             # writes tasks.md/.csv/.json
```

Full guide, including how to get your export and what it costs:
[`docs/TASK_SCANNER.md`](docs/TASK_SCANNER.md).

## Setup
1. Clone repo
2. Copy `.env.local.example` to `.env.local` and fill in your keys
3. `npm install`
4. `npm run dev`

## Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `ANTHROPIC_API_KEY` — For AI copy generation and the task scanner
- `DUDA_API_USER` / `DUDA_API_PASS` — For site automation (Phase 2)
- `TASK_SCANNER_MODEL` / `TASK_SCANNER_EFFORT` — Optional scanner overrides
- `TASK_SCANNER_TOKEN` — Optional; gates `/api/tasks/scan` behind a shared
  secret. Set it on any deployment reachable from the internet.
