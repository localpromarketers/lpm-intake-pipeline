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
