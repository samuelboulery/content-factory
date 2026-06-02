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
  notification_emails text[] not null default '{}', -- destinataires du digest quotidien (US-8.3)
  network_charters jsonb not null default '{}'::jsonb, -- overlay de charte par réseau (US-2.5)
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
  workspace_id uuid not null references workspaces(id) on delete cascade,
  network text not null default 'LinkedIn', -- réseau cible de la génération (US-2.5)
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
  previous_versions jsonb not null default '[]'::jsonb, -- 3 dernières régénérations (US-5.10), plus récent en tête
  ai_review jsonb, -- verdict du relecteur IA de conformité (US-5.5, flag seul) ; null si non relu
  original_content text, -- brouillon IA figé (diff vs édition humaine, boucle d'apprentissage charte)
  created_at timestamptz not null default now()
);

create index if not exists workspaces_owner_id_idx on workspaces(owner_id);
create index if not exists charter_versions_workspace_idx on charter_versions(workspace_id);
create index if not exists communications_workspace_id_idx on communications(workspace_id);
create index if not exists posts_communication_id_idx on posts(communication_id);
create index if not exists posts_communication_status_idx on posts(communication_id, status);
create index if not exists posts_published_at_idx on posts(published_at);

-- ── Multi-user : membres + rôles (US-1.4) ────────────────────────────────────
create table if not exists workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists workspace_members_user_idx on workspace_members(user_id);

-- Backfill : owners existants -> membres 'owner'.
insert into workspace_members (workspace_id, user_id, role)
select id, owner_id, 'owner' from workspaces
on conflict (workspace_id, user_id) do nothing;

-- Rôle de l'appelant (SECURITY DEFINER → pas de récursion RLS ; ne renvoie QUE
-- la ligne de auth.uid(), aucune fuite). authenticated only.
create or replace function public.workspace_role(p_ws uuid)
returns text language sql security definer stable set search_path = public as $$
  select role from public.workspace_members where workspace_id = p_ws and user_id = auth.uid();
$$;
revoke all on function public.workspace_role(uuid) from public;
revoke execute on function public.workspace_role(uuid) from anon;
grant execute on function public.workspace_role(uuid) to authenticated;

-- Création atomique workspace + membre owner (bootstrap). authenticated only.
create or replace function public.create_workspace(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if coalesce(trim(p_name),'') = '' then raise exception 'Nom requis'; end if;
  insert into public.workspaces (name, owner_id) values (trim(p_name), auth.uid()) returning id into v_id;
  insert into public.workspace_members (workspace_id, user_id, role) values (v_id, auth.uid(), 'owner');
  return v_id;
end; $$;
revoke all on function public.create_workspace(text) from public;
revoke execute on function public.create_workspace(text) from anon;
grant execute on function public.create_workspace(text) to authenticated;

-- RLS : accès = MEMBRE du workspace. Écriture com/posts = owner+editor ;
-- charte/template/réglages = owner seul (gouvernance, US-1.5).
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table charter_versions enable row level security;
alter table communications enable row level security;
alter table posts enable row level security;

drop policy if exists workspace_members_read on workspace_members;
create policy workspace_members_read on workspace_members
  for select using (public.workspace_role(workspace_id) is not null);
drop policy if exists workspace_members_owner_write on workspace_members;
create policy workspace_members_owner_write on workspace_members
  for all using (public.workspace_role(workspace_id) = 'owner')
  with check (public.workspace_role(workspace_id) = 'owner');

drop policy if exists workspaces_owner_all on workspaces;
drop policy if exists workspaces_member_read on workspaces;
create policy workspaces_member_read on workspaces
  for select using (public.workspace_role(id) is not null);
drop policy if exists workspaces_owner_update on workspaces;
create policy workspaces_owner_update on workspaces
  for update using (public.workspace_role(id) = 'owner')
  with check (public.workspace_role(id) = 'owner');
drop policy if exists workspaces_owner_delete on workspaces;
create policy workspaces_owner_delete on workspaces
  for delete using (public.workspace_role(id) = 'owner');
-- (insert workspaces : uniquement via create_workspace SECURITY DEFINER)

drop policy if exists charter_versions_owner_all on charter_versions;
drop policy if exists charter_versions_member_read on charter_versions;
create policy charter_versions_member_read on charter_versions
  for select using (public.workspace_role(workspace_id) is not null);
drop policy if exists charter_versions_owner_write on charter_versions;
create policy charter_versions_owner_write on charter_versions
  for all using (public.workspace_role(workspace_id) = 'owner')
  with check (public.workspace_role(workspace_id) = 'owner');

drop policy if exists communications_owner_all on communications;
drop policy if exists communications_member_read on communications;
create policy communications_member_read on communications
  for select using (public.workspace_role(workspace_id) is not null);
drop policy if exists communications_editor_write on communications;
create policy communications_editor_write on communications
  for all using (public.workspace_role(workspace_id) in ('owner','editor'))
  with check (public.workspace_role(workspace_id) in ('owner','editor'));

drop policy if exists posts_owner_all on posts;
drop policy if exists posts_member_read on posts;
create policy posts_member_read on posts
  for select using (communication_id in (
    select id from public.communications where public.workspace_role(workspace_id) is not null));
drop policy if exists posts_editor_write on posts;
create policy posts_editor_write on posts
  for all using (communication_id in (
    select id from public.communications where public.workspace_role(workspace_id) in ('owner','editor')))
  with check (communication_id in (
    select id from public.communications where public.workspace_role(workspace_id) in ('owner','editor')));

-- ── Form intervenants public à token (US-6.2) ───────────────────────────────
create unique index if not exists communications_share_token_idx on communications(share_token);

create table if not exists intervenant_submissions (
  id uuid primary key default gen_random_uuid(),
  communication_id uuid not null references communications(id) on delete cascade,
  name text not null,
  role text,
  bio text,
  message text,
  subject text, -- sujet d'intervention (form interne #2)
  link text, -- lien LinkedIn / site
  created_at timestamptz not null default now()
);
create index if not exists intervenant_submissions_comm_idx on intervenant_submissions(communication_id);

alter table intervenant_submissions enable row level security;
drop policy if exists intervenant_submissions_owner_read on intervenant_submissions;
drop policy if exists intervenant_submissions_member_read on intervenant_submissions;
create policy intervenant_submissions_member_read on intervenant_submissions
  for select
  using (communication_id in (
    select id from public.communications where public.workspace_role(workspace_id) is not null));

-- Fonctions security-definer accessibles à anon (le seul chemin public).
create or replace function public.get_communication_public(p_token uuid)
returns table (name text, event_date date, event_location text, suggested_questions text[])
language sql security definer set search_path = public
as $$
  select c.name, c.event_date, c.event_location, c.suggested_questions
  from public.communications c
  where c.share_token = p_token limit 1;
$$;
revoke all on function public.get_communication_public(uuid) from public;
grant execute on function public.get_communication_public(uuid) to anon, authenticated;

create or replace function public.submit_intervenant(
  p_token uuid, p_name text, p_role text, p_bio text, p_message text,
  p_subject text, p_link text
) returns void
language plpgsql security definer set search_path = public
as $$
declare v_comm_id uuid;
begin
  select c.id into v_comm_id from public.communications c where c.share_token = p_token limit 1;
  if v_comm_id is null then raise exception 'Token invalide'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Nom requis'; end if;
  insert into public.intervenant_submissions
    (communication_id, name, role, bio, message, subject, link)
  values (v_comm_id, trim(p_name),
    nullif(trim(p_role), ''), nullif(trim(p_bio), ''), nullif(trim(p_message), ''),
    nullif(trim(p_subject), ''), nullif(trim(p_link), ''));
end;
$$;
revoke all on function public.submit_intervenant(uuid, text, text, text, text, text, text) from public;
grant execute on function public.submit_intervenant(uuid, text, text, text, text, text, text) to anon, authenticated;

-- ── Templates de communication (US-3.1/3.3/3.4) ──────────────────────────────
-- Plusieurs templates nommés par workspace ; chaque com en choisit un.
create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index if not exists templates_workspace_idx on templates(workspace_id);

alter table templates enable row level security;
drop policy if exists templates_member_read on templates;
create policy templates_member_read on templates
  for select using (public.workspace_role(workspace_id) is not null);
drop policy if exists templates_owner_write on templates;
create policy templates_owner_write on templates
  for all using (public.workspace_role(workspace_id) = 'owner')
  with check (public.workspace_role(workspace_id) = 'owner');

-- Étapes d'un template (offset + intention + niveau d'info). workspace_id gardé pour la RLS.
create table if not exists template_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  template_id uuid references templates(id) on delete cascade,
  position int not null,
  offset_days int not null,
  intention text not null,
  info_required text,
  created_at timestamptz not null default now(),
  unique (template_id, position)
);
create index if not exists template_steps_workspace_idx on template_steps(workspace_id);
create index if not exists template_steps_template_idx on template_steps(template_id);

alter table template_steps enable row level security;
drop policy if exists template_steps_owner_all on template_steps;
drop policy if exists template_steps_member_read on template_steps;
create policy template_steps_member_read on template_steps
  for select using (public.workspace_role(workspace_id) is not null);
drop policy if exists template_steps_owner_write on template_steps;
create policy template_steps_owner_write on template_steps
  for all using (public.workspace_role(workspace_id) = 'owner')
  with check (public.workspace_role(workspace_id) = 'owner');

-- ── Invitations par lien-token (US-1.4b) ─────────────────────────────────────
create table if not exists workspace_invites (
  token uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  role text not null default 'editor' check (role in ('editor','viewer')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz
);
create index if not exists workspace_invites_workspace_idx on workspace_invites(workspace_id);

alter table workspace_invites enable row level security;
drop policy if exists workspace_invites_owner_all on workspace_invites;
create policy workspace_invites_owner_all on workspace_invites
  for all using (public.workspace_role(workspace_id) = 'owner')
  with check (public.workspace_role(workspace_id) = 'owner');

-- Lecture publique d'une invitation (page /invite, avant connexion).
create or replace function public.get_invite_public(p_token uuid)
returns table (workspace_name text, role text, valid boolean)
language sql security definer stable set search_path = public as $$
  select w.name, i.role, (i.accepted_at is null and i.expires_at > now())
  from public.workspace_invites i join public.workspaces w on w.id = i.workspace_id
  where i.token = p_token limit 1;
$$;
revoke all on function public.get_invite_public(uuid) from public;
grant execute on function public.get_invite_public(uuid) to anon, authenticated;

-- Accepter (ajoute le membre, marque acceptée). authenticated only.
create or replace function public.accept_invite(p_token uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_ws uuid; v_role text; v_exp timestamptz; v_acc timestamptz;
begin
  select workspace_id, role, expires_at, accepted_at into v_ws, v_role, v_exp, v_acc
    from public.workspace_invites where token = p_token;
  if v_ws is null then raise exception 'Invitation invalide'; end if;
  if v_acc is not null then raise exception 'Invitation deja utilisee'; end if;
  if v_exp <= now() then raise exception 'Invitation expiree'; end if;
  insert into public.workspace_members (workspace_id, user_id, role)
    values (v_ws, auth.uid(), v_role) on conflict (workspace_id, user_id) do nothing;
  update public.workspace_invites set accepted_by = auth.uid(), accepted_at = now() where token = p_token;
  return v_ws;
end; $$;
revoke all on function public.accept_invite(uuid) from public;
revoke execute on function public.accept_invite(uuid) from anon;
grant execute on function public.accept_invite(uuid) to authenticated;

-- Membres + emails, pour les membres du workspace. authenticated only.
create or replace function public.list_workspace_members(p_ws uuid)
returns table (user_id uuid, email text, role text)
language sql security definer stable set search_path = public as $$
  select m.user_id, u.email::text, m.role
  from public.workspace_members m join auth.users u on u.id = m.user_id
  where m.workspace_id = p_ws and public.workspace_role(p_ws) is not null
  order by m.created_at;
$$;
revoke all on function public.list_workspace_members(uuid) from public;
revoke execute on function public.list_workspace_members(uuid) from anon;
grant execute on function public.list_workspace_members(uuid) to authenticated;

-- ── Boucle d'apprentissage charte (corpus de diffs IA→humain) ────────────────
-- Dernière analyse par workspace : observations + addendum proposé à la charte.
create table if not exists charter_learnings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  observations jsonb not null default '[]'::jsonb,
  addendum text,
  sample_size int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists charter_learnings_workspace_idx on charter_learnings(workspace_id);

alter table charter_learnings enable row level security;
drop policy if exists charter_learnings_owner_all on charter_learnings;
create policy charter_learnings_owner_all on charter_learnings
  for all using (public.workspace_role(workspace_id) = 'owner')
  with check (public.workspace_role(workspace_id) = 'owner');
