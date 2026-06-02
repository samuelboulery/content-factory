# Content Factory

Atelier de création éditoriale assisté par IA pour **The Design Society (TDS)**. Génère des posts LinkedIn conformes à une charte éditoriale, avec rétroplanning automatique (J-30 / J-15 / J-5 / J-1) autour d'un événement. MVP — **walking skeleton** en cours de construction.

> Sam est System Designer (pas développeur) : il orchestre, Claude code, il vérifie. **Toutes les explications en français**, claires, sans jargon inutile. Poser une question plutôt que deviner sur un choix non trivial.

## Architecture

Monolithe Next.js (App Router). La clé LLM reste **serveur** (route API). Supabase pour la persistance.

```
Browser ──> /communications/new  (formulaire, composant client)
                │ POST JSON
                ▼
         /api/generate  (route serveur)
                │  generatePosts(facts, intervenants) → DeepSeek
                │  addDays(event_date, offset) + findFreeDate (anti-collision, US-5.4)
                │  insert communications + 4 posts
                ▼
            Supabase (Postgres)
                ▲
                │ select
         /communications/[id]  (server component)
                │  checkCompliance(content)  [déterministe, zéro IA]
                └─> PostCard (client) : contenu, date FR, so_what, badge conformité, Copier
```

**Tech stack :**
- Front : **Next.js 15.5** (App Router), **React 19**, **TypeScript strict**
- UI : Tailwind CSS v4 + **shadcn/ui** (button, input, textarea, card, label, badge)
- DB : Supabase (Postgres) — projet `content-factory`, région eu-west-3 (géré via MCP)
- LLM : **DeepSeek** (`deepseek-chat`), appelé **serveur uniquement**
- Dates : `date-fns` (locale `fr`)

## Key Commands

```bash
npm run dev        # serveur de dev (http://localhost:3000)
npm run build      # build production
npm run lint       # ESLint
npx tsc --noEmit   # vérification de types stricte
npx shadcn@latest add <composant>   # ajouter un composant UI
```

Supabase : création projet, migrations et clés via MCP. Schéma = source de vérité dans `supabase-schema.sql`.

## Code Conventions

- **TypeScript strict** : pas de `any` sans justification écrite en commentaire.
- **UI** : exclusivement shadcn/ui. Styling **Tailwind only**, aucun style inline.
- **App Router Next 15** : `params` et `searchParams` des pages/routes sont des **Promises** → `await params`. Les requêtes (`cookies()`, `headers()`) sont async. `fetch` n'est plus mis en cache par défaut.
- **Fichiers** : petits et focalisés (`src/lib/`, `src/components/`, `src/app/`). Immutabilité (pas de mutation en place).
- **Dates affichées** : `format(date, 'd MMMM yyyy', { locale: fr })`.
- **Parsing réponse LLM** : toujours défensif (strip des backticks markdown avant `JSON.parse`, validation de la forme).
- **Commits** : Conventional Commits en **français** (`feat:`, `fix:`, `docs:`…). Un commit par palier validé.

## Constraints (non négociable)

- **L'IA n'invente jamais un fait pratique** (lieu, horaire, lien, prix, intervenant non fourni). Manque *normal* au stade → changer d'angle (save-the-date / teasing). Manque *anormal* → `[À COMPLÉTER : x]`. Jamais d'invention.
- **Badge de conformité déterministe** (zéro appel IA) : exclamations ≤ 3, pas de superlatif creux, pas de `\bnous\b` (ton « on »), longueur 600–1200, closing formula présente.
- **Relecteur IA de conformité** (US-5.5, `reviewCampaign`/`reviewSinglePost` dans `llm.ts`) : 2e passe LLM à la génération **et** à la régénération, vérifie la conformité *sémantique* à la charte (ton, « on », bénéfice lecteur, anti-invention). **Flag seul** (ne réécrit jamais) → `posts.ai_review` (jsonb `{conforme, remarks[]}`), affiché sur la carte. **Best-effort** : un échec de relecture ne bloque pas la génération.
- **Clé `DEEPSEEK_API_KEY` strictement serveur** — jamais importée ni exposée côté client.
- **Ne jamais committer `.env.local`** ni aucune clé.
- **Demander avant d'ajouter une dépendance** hors stack listée.
- **Demander avant toute action destructive** (rm, reset --hard, DB reset).
- Scope actuel : auth + multi-workspace + switcher + settings + charte versionnée + contexte/réseaux + génération chaînée + anti-hallucination + conformité + régénération/édition + **historique 3 régén (US-5.10)** + statut publié (édition auto-détectée) + faits durs corrigeables + flag divergence + dashboard + calendrier + **timeline par com (US-7.3)** + form intervenants public à token + rétroplanning paramétrable + **import charte .skill (US-2.4)** + **digest email quotidien à destinataires configurables (US-8.3, Resend + Vercel Cron)** + **positionnement calendrier anti-chevauchement + date éditable (US-5.4)** + **charte par réseau (overlay) + sélecteur réseau à la génération (US-2.5)** + **relecteur IA de conformité sémantique, flag seul (US-5.5)**. + **permissions multi-users owner/editor/viewer + invitations par lien (US-1.4/1.5)** + **templates custom multi (US-3.4 : N templates nommés par workspace, sélecteur à la création)** + **boucle d'apprentissage charte (corpus de diffs IA→humain → addendum proposé)**. **V1 (Should) terminée.** Pas encore : génération de visuels (V2+). **US-6.1 (Google Form fallback) abandonnée** (le form interne la remplace) → on améliore le form interne : ✅ intégration « Ajouter à la matière » (soumission → `intervenants_text`) + ✅ champs additionnels (sujet d'intervention, lien LinkedIn/site) + ✅ UX form public (lieu affiché, « Envoyer une autre réponse ») + ✅ questions suggérées IA (US-6.3 : owner génère via `suggestIntervenantQuestions`, stockées dans `communications.suggested_questions`, affichées sur le form public). **Amélioration form interne terminée.** Référence produit : `content-factory-prd.md` + `content-factory-backlog.md`.
- **Templates custom multi** (US-3.4) : table `templates` (N par workspace) + `template_steps.template_id` (`templates.ts`, `template-steps.ts`). Chaque com choisit un template à la création (sélecteur dans le form) ; la génération utilise ses étapes (offsets déterministes, pas la réponse LLM). Éditables dans `/settings` (owner) via `TemplateStepsEditor` (ajout/suppression d'étapes). Fallback `DEFAULT_EVENT_STEPS` si un template n'a pas d'étapes. Le nombre de posts = nombre d'étapes. `createWorkspace` seed un template « Event » par défaut.
- **Form intervenants public** (`/intervenants/[token]`, hors auth via middleware) : la matière arrive sans compte. Sécurité = 2 fonctions Postgres **security-definer** (`get_communication_public`, `submit_intervenant`) accordées à `anon` ; RLS reste verrouillée (anon ne peut PAS lire `intervenant_submissions`). Token = `communications.share_token`. Lien copiable + soumissions affichées sur la page com.

## Environment Variables

| Variable | Requis | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Clé publishable / anon Supabase |
| `DEEPSEEK_API_KEY` | ✅ | Clé API DeepSeek (**serveur uniquement**) |
| `SUPABASE_SERVICE_ROLE_KEY` | cron | Service-role (**bypasse la RLS**) — cron uniquement, **serveur**, jamais exposé |
| `RESEND_API_KEY` | cron | Clé API Resend (envoi du digest) |
| `RESEND_FROM` | cron | Expéditeur du digest (ex : `... <digest@domaine>` ; domaine vérifié Resend) |
| `CRON_SECRET` | cron | Secret partagé Vercel Cron → `Authorization: Bearer` |

Les 4 vars `cron` ne sont requises que pour le digest email (US-8.3) : à définir en local **et** sur Vercel. `.env.local.example` versionné (valeurs vides) ; `.env.local` jamais commité.

## Team & Process

Solo (Sam, owner). Développement **par paliers validés un à un**. Source de vérité produit : `content-factory-prd.md` et `content-factory-backlog.md`. Les agents reviewers / planner / tdd-guide sont disponibles via la config globale `~/.claude`.

## Auth & sécurité

- **Auth = Supabase Auth (magic link)**. Clients SSR via `@supabase/ssr` : `src/lib/supabase/server.ts` (Server Components / routes), `client.ts` (navigateur), `middleware.ts` (refresh session + protège `/` et `/communications/*`, redirige vers `/login`).
- **RLS membre-scoped** (multi-user US-1.4) : table `workspace_members(workspace_id, user_id, role)` (owner/editor/viewer). Fonction **SECURITY DEFINER** `workspace_role(ws)` (ne renvoie que le rôle de `auth.uid()` → pas de récursion ni fuite, `authenticated` only). Accès lecture = membre ; écriture com/posts = owner+editor ; écriture charte/template/réglages = owner seul (gouvernance US-1.5). Création workspace via `create_workspace()` SECURITY DEFINER (ws + membre owner atomique). `listWorkspaces` = workspaces dont on est membre. **Invitation par lien-token (1.4b)** : table `workspace_invites` (rôle editor/viewer, expire 7j, usage unique), page publique `/invite/[token]` (hors auth via middleware ; `get_invite_public` lisible anon, `accept_invite`/`list_workspace_members` authenticated only), section « Membres & invitations » dans `/settings` (owner crée/révoque liens, retire membres ; `members.ts` + `member-actions.ts`). Login propage `?next=` (callback sanitize anti open-redirect). **Gating UI des rôles (1.4c, US-1.5)** : `getWorkspaceRole` (`members.ts`) → owner voit l'édition charte/template/contexte/réglages ; editor+owner créent/éditent coms+posts (bouton « Nouvelle com », actions PostCard, fiche, matière, questions) ; viewer = lecture seule. Badge rôle dans la sidebar. **Le RLS reste la vraie barrière** (le gating UI n'est que cosmétique). US-1.4 + US-1.5 complets.
- Multi-workspace : création de workspaces nommés + switcher type Slack (sidebar dans le route group `src/app/(app)/layout.tsx`). Workspace actif stocké en cookie `cf_active_workspace` (`src/lib/workspace.ts` + server actions `workspace-actions.ts`). **Pas d'auto-création de workspace** : un nouvel utilisateur crée le sien (sidebar) ou rejoint via lien d'invitation ; sinon onboarding sur le dashboard (`resolveActiveWorkspace` renvoie `active: null`). Les communications sont scopées au workspace actif.
- Charte éditoriale **versionnée par workspace** (`charter_versions`, append-only, version la plus haute = active). Éditable dans `/settings` (`charter-versions.ts` + `charter-actions.ts`) ; rollback = ré-append. La génération utilise la charte active du workspace ; `TDS_CHARTER` (constante `charter.ts`) sert de seed v1 + fallback. **Génération multi-plateformes** : la liste des plateformes = `src/lib/networks.ts` (LinkedIn, Instagram, Facebook, Twitter/X, WhatsApp, Newsletter/Email). À la création, multi-sélection (cases à cocher, toutes par défaut) → `/api/generate` génère **en parallèle** (`Promise.allSettled`, cap 60s) un set de posts **par plateforme** ; chaque post est taggé `posts.network`, la com stocke `communications.networks[]` (`communications.network` = legacy/1ʳᵉ). **Overlay par réseau** (US-2.5) : `workspaces.network_charters` (jsonb, `/settings`) fusionné à la charte de base via `network-charter.ts` par plateforme. Anti-collision **par plateforme** (mêmes jours entre plateformes, décalés au sein d'une plateforme). Régénération applique l'overlay de la plateforme du post + contexte campagne limité à la même plateforme. Affichage groupé par plateforme (détail), badge plateforme (PostCard, calendrier).
- Régénération/édition de posts (`src/lib/post-actions.ts`, UI dans `PostCard`). `regeneratePost` (`llm.ts`) reçoit **toute la campagne** en contexte, les posts `published` marqués « ne pas contredire ». Appel DeepSeek factorisé dans `callDeepSeek`. Édition manuelle = update direct du contenu. **Historique des 3 dernières régénérations** (US-5.10) : colonne `posts.previous_versions jsonb` (snapshot avant écrasement, borné à 3, plus récent en tête) ; `rollbackPostAction` restaure une version **sans appel LLM**.

## Boucle d'apprentissage charte

- **Capture** : `posts.original_content` = brouillon IA figé (posé à la génération + régénération) ; l'édition manuelle ne le touche pas → pour un post **édité+publié**, `original_content` (IA) ≠ `content` (humain) = une correction.
- **Analyse** (owner, `/settings` → « Analyser mes corrections ») : `analyzeCharterLearnings` (`llm.ts`) lit le corpus de diffs (max 20) → `{observations[], addendum}`, stocké dans `charter_learnings` (owner-only). 1 appel LLM.
- **Application** : l'owner relit → « Appliquer » append l'addendum à la charte = **nouvelle version** (versioning existant, rollback possible) ; « Ignorer » supprime. `charter-learnings.ts` (read) + `charter-learning-actions.ts`.

## Notifications & cron (US-8.3)

- **Digest email quotidien** des posts à publier le jour même, par workspace. Provider **Resend** (`src/lib/email.ts`), déclenché par **Vercel Cron** (`vercel.json`, `0 7 * * *`) qui appelle `GET /api/cron/daily-digest`.
- Route protégée par `CRON_SECRET` (header `Authorization: Bearer`, injecté auto par Vercel). `/api` est hors auth dans le middleware.
- Le cron n'a pas d'utilisateur connecté → client **service-role** (`src/lib/supabase/admin.ts`) qui **bypasse la RLS**. SERVEUR UNIQUEMENT, jamais `NEXT_PUBLIC`, jamais commité.
- Destinataires = `workspaces.notification_emails` (éditables dans `/settings`, parsés par `email-recipients.ts`) ; **fallback** email du propriétaire si la liste est vide. Logique de collecte dans `daily-digest.ts`.

## graphify

Graphe de connaissance dans `graphify-out/` (non versionné — reconstruit localement).

**Avant d'explorer le code :** lire `graphify-out/GRAPH_REPORT.md`, puis `/graphify query "<question>"` pour les questions transverses.

**Après changements :**
- Commits de code → hook post-commit relance l'extraction AST (sans LLM)
- Docs / nouvelles features → `/graphify . --update` manuellement
