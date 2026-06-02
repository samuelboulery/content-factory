-- Content Factory — schéma complet (source de vérité)
-- Tables : workspaces + charter_versions + communications + posts
-- Auth : Supabase Auth (magic link). RLS activée, policies owner-scoped via auth.uid().

create extension if not exists pgcrypto;

-- Workspaces (owner unique au slice : pas encore multi-membres)
create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  context text, -- contexte général de l'asso/projet (injecté dans la génération)
  networks text[] not null default '{}', -- réseaux ciblés (LinkedIn, Instagram…)
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
  share_token uuid not null default gen_random_uuid(), -- lien public du form intervenants
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

-- ── Form intervenants public à token (US-6.2) ───────────────────────────────
create unique index if not exists communications_share_token_idx on communications(share_token);

create table if not exists intervenant_submissions (
  id uuid primary key default gen_random_uuid(),
  communication_id uuid not null references communications(id) on delete cascade,
  name text not null,
  role text,
  bio text,
  message text,
  created_at timestamptz not null default now()
);
create index if not exists intervenant_submissions_comm_idx on intervenant_submissions(communication_id);

alter table intervenant_submissions enable row level security;
drop policy if exists intervenant_submissions_owner_read on intervenant_submissions;
create policy intervenant_submissions_owner_read on intervenant_submissions
  for select
  using (communication_id in (
    select c.id from communications c
    join workspaces w on w.id = c.workspace_id
    where w.owner_id = auth.uid()
  ));

-- Fonctions security-definer accessibles à anon (le seul chemin public).
create or replace function public.get_communication_public(p_token uuid)
returns table (name text, event_date date)
language sql security definer set search_path = public
as $$
  select c.name, c.event_date from public.communications c
  where c.share_token = p_token limit 1;
$$;
revoke all on function public.get_communication_public(uuid) from public;
grant execute on function public.get_communication_public(uuid) to anon, authenticated;

create or replace function public.submit_intervenant(
  p_token uuid, p_name text, p_role text, p_bio text, p_message text
) returns void
language plpgsql security definer set search_path = public
as $$
declare v_comm_id uuid;
begin
  select c.id into v_comm_id from public.communications c where c.share_token = p_token limit 1;
  if v_comm_id is null then raise exception 'Token invalide'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Nom requis'; end if;
  insert into public.intervenant_submissions (communication_id, name, role, bio, message)
  values (v_comm_id, trim(p_name), nullif(trim(p_role), ''), nullif(trim(p_bio), ''), nullif(trim(p_message), ''));
end;
$$;
revoke all on function public.submit_intervenant(uuid, text, text, text, text) from public;
grant execute on function public.submit_intervenant(uuid, text, text, text, text) to anon, authenticated;
