-- Content Factory — schéma complet (source de vérité)
-- Tables : workspaces + charter_versions + communications + posts
-- Auth : Supabase Auth (magic link). RLS activée, policies owner-scoped via auth.uid().

create extension if not exists pgcrypto;

-- Workspaces (owner unique au slice : pas encore multi-membres)
create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Charte éditoriale versionnée (append-only ; la version la plus haute est active)
create table if not exists charter_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  content text not null,
  version integer not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, version)
);

create table if not exists communications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date not null,
  event_location text,
  event_link text,
  intervenants_text text,
  workspace_id uuid references workspaces(id) on delete cascade,
  facts_updated_at timestamptz not null default now(), -- bumpé à chaque édition des faits durs
  created_at timestamptz not null default now()
);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  communication_id uuid not null references communications(id) on delete cascade,
  scheduled_date date not null,
  content text not null,
  so_what text,
  status text not null default 'to_publish',
  edited boolean not null default false, -- édition humaine détectée (mesure % publié sans édition)
  published_at timestamptz, -- horodatage de publication (pour le flag de divergence)
  created_at timestamptz not null default now()
);

create index if not exists workspaces_owner_id_idx on workspaces(owner_id);
create index if not exists charter_versions_workspace_idx on charter_versions(workspace_id);
create index if not exists communications_workspace_id_idx on communications(workspace_id);
create index if not exists posts_communication_id_idx on posts(communication_id);

-- RLS : chaque utilisateur ne voit que les données de ses workspaces.
alter table workspaces enable row level security;
alter table charter_versions enable row level security;
alter table communications enable row level security;
alter table posts enable row level security;

drop policy if exists workspaces_owner_all on workspaces;
create policy workspaces_owner_all on workspaces
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists charter_versions_owner_all on charter_versions;
create policy charter_versions_owner_all on charter_versions
  for all
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()))
  with check (workspace_id in (select id from workspaces where owner_id = auth.uid()));

drop policy if exists communications_owner_all on communications;
create policy communications_owner_all on communications
  for all
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()))
  with check (workspace_id in (select id from workspaces where owner_id = auth.uid()));

drop policy if exists posts_owner_all on posts;
create policy posts_owner_all on posts
  for all
  using (communication_id in (
    select c.id from communications c
    join workspaces w on w.id = c.workspace_id
    where w.owner_id = auth.uid()
  ))
  with check (communication_id in (
    select c.id from communications c
    join workspaces w on w.id = c.workspace_id
    where w.owner_id = auth.uid()
  ));
