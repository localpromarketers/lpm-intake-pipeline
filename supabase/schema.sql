-- LPM Intake Pipeline — database schema
-- ---------------------------------------------------------------------------
-- Reverse-engineered from the application code (lib/supabase.js, the intake
-- form, and the admin dashboard). Run this once in your Supabase project:
--   Supabase dashboard → SQL Editor → New query → paste → Run.
--
-- It creates the 8 tables the app reads/writes, plus indexes and the storage
-- bucket used for logo/photo uploads.
--
-- ⚠️  SECURITY NOTE: Row Level Security (RLS) is DISABLED below so the app works
-- immediately with the public anon key (the intake form is gated by a secret
-- access_token in the URL, not by the database). This is fine for development
-- and internal use. Before exposing this publicly you should enable RLS and add
-- policies — ask and I'll generate a locked-down version.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";  -- for gen_random_uuid()

-- ── submissions ────────────────────────────────────────────────────────────
-- One row per client intake. `access_token` is the secret in the intake URL.
create table if not exists public.submissions (
  id                  uuid primary key default gen_random_uuid(),
  access_token        uuid not null unique default gen_random_uuid(),
  vertical            text default 'home_services',
  business_category   text,
  status              text not null default 'draft',

  -- Business identity
  business_name       text,
  tagline             text,
  year_established    text,
  owner_names         text,
  license_number      text,
  emergency_service   boolean default false,

  -- Contact & location
  email               text,
  primary_phone       text,
  secondary_phone     text,
  street              text,
  city                text,
  county              text,
  state               text,
  zip                 text,

  -- Service area
  primary_city        text,
  additional_cities   text,
  service_radius      text,

  -- Online presence
  existing_website    text,
  gbp_url             text,
  facebook            text,
  instagram           text,
  linkedin            text,
  youtube             text,
  nextdoor            text,
  google_review_count integer,
  google_star_rating  numeric(2,1),

  -- Trust / proof
  certifications      text,
  warranties          text,
  financing           text,
  insurance_info      text,

  -- Brand & design
  design_style        text,
  primary_color       text,
  secondary_color     text,
  tone                text,

  -- Website copy
  hero_headline       text,
  hero_subheadline    text,
  raw_description     text,
  polished_description text,
  about_us            text,
  why_choose_us       text,
  what_makes_different text,
  ai_tagline_options  jsonb,

  -- Build / output (Phase 2 — Duda automation)
  duda_site_url       text,
  duda_published_url  text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── services ───────────────────────────────────────────────────────────────
create table if not exists public.services (
  id             uuid primary key default gen_random_uuid(),
  submission_id  uuid not null references public.submissions(id) on delete cascade,
  service_name   text,
  category       text,
  description    text,
  ai_description text,
  price_range    text,
  is_emergency   boolean default false,
  sort_order     integer default 0,
  created_at     timestamptz not null default now()
);

-- ── testimonials ───────────────────────────────────────────────────────────
create table if not exists public.testimonials (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  quote_text    text,
  author_name   text,
  author_city   text,
  rating        integer default 5,
  service_type  text,
  sort_order    integer default 0,
  created_at    timestamptz not null default now()
);

-- ── business_hours ─────────────────────────────────────────────────────────
create table if not exists public.business_hours (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  day_of_week   text,
  open_time     text,
  close_time    text,
  is_closed     boolean default false,
  sort_order    integer default 0
);

-- ── portfolio_items ────────────────────────────────────────────────────────
create table if not exists public.portfolio_items (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  title         text,
  description   text,
  image_url     text,
  project_type  text,
  sort_order    integer default 0,
  created_at    timestamptz not null default now()
);

-- ── team_bios ──────────────────────────────────────────────────────────────
create table if not exists public.team_bios (
  id               uuid primary key default gen_random_uuid(),
  submission_id    uuid not null references public.submissions(id) on delete cascade,
  member_name      text,
  role             text,
  bio              text,
  photo_url        text,
  years_experience text,
  sort_order       integer default 0,
  created_at       timestamptz not null default now()
);

-- ── build_logs ─────────────────────────────────────────────────────────────
-- Activity trail for the admin dashboard (build steps, status changes).
create table if not exists public.build_logs (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  step          text,
  action        text,
  status        text,
  message       text,
  started_at    timestamptz not null default now(),
  completed_at  timestamptz
);

-- ── file_uploads ───────────────────────────────────────────────────────────
-- Tracks files uploaded to the 'client-uploads' storage bucket.
create table if not exists public.file_uploads (
  id              uuid primary key default gen_random_uuid(),
  submission_id   uuid not null references public.submissions(id) on delete cascade,
  file_name       text,
  file_type       text,
  storage_path    text,
  public_url      text,
  file_size_bytes bigint,
  created_at      timestamptz not null default now()
);

-- ── indexes ────────────────────────────────────────────────────────────────
create index if not exists idx_submissions_access_token on public.submissions(access_token);
create index if not exists idx_submissions_status       on public.submissions(status);
create index if not exists idx_services_submission       on public.services(submission_id);
create index if not exists idx_testimonials_submission   on public.testimonials(submission_id);
create index if not exists idx_business_hours_submission on public.business_hours(submission_id);
create index if not exists idx_portfolio_submission      on public.portfolio_items(submission_id);
create index if not exists idx_team_bios_submission      on public.team_bios(submission_id);
create index if not exists idx_build_logs_submission     on public.build_logs(submission_id);
create index if not exists idx_file_uploads_submission   on public.file_uploads(submission_id);

-- ── auto-update updated_at on submissions ──────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_submissions_updated_at on public.submissions;
create trigger trg_submissions_updated_at
  before update on public.submissions
  for each row execute function public.set_updated_at();

-- ── storage bucket for client uploads (logos, photos) ──────────────────────
-- Creates a public bucket named 'client-uploads' (used by uploadFile()).
insert into storage.buckets (id, name, public)
values ('client-uploads', 'client-uploads', true)
on conflict (id) do nothing;
