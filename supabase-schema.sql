-- Content Factory — schéma walking skeleton
-- Tables : communications (faits durs) + posts (4 posts générés par com)
-- Note : pas d'auth au skeleton → RLS désactivée (défaut). Fermé avec l'auth (Epic 1).

create extension if not exists pgcrypto;

create table if not exists communications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date not null,
  event_location text,
  event_link text,
  intervenants_text text,
  created_at timestamptz not null default now()
);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  communication_id uuid not null references communications(id) on delete cascade,
  scheduled_date date not null,
  content text not null,
  so_what text,
  status text not null default 'to_publish',
  created_at timestamptz not null default now()
);

create index if not exists posts_communication_id_idx on posts(communication_id);
