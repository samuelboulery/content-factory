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
                │  addDays(event_date, offset) → scheduled_date
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
- **Clé `DEEPSEEK_API_KEY` strictement serveur** — jamais importée ni exposée côté client.
- **Ne jamais committer `.env.local`** ni aucune clé.
- **Demander avant d'ajouter une dépendance** hors stack listée.
- **Demander avant toute action destructive** (rm, reset --hard, DB reset).
- Scope = walking skeleton : pas d'auth, pas de multi-workspace, pas d'édition/régénération, pas de visuels. Référence produit : `content-factory-prd.md` + `content-factory-backlog.md`.

## Environment Variables

| Variable | Requis | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Clé publishable / anon Supabase |
| `DEEPSEEK_API_KEY` | ✅ | Clé API DeepSeek (**serveur uniquement**) |

`.env.local.example` versionné (valeurs vides) ; `.env.local` jamais commité.

## Team & Process

Solo (Sam, owner). Développement **par paliers validés un à un**. Source de vérité produit : `content-factory-prd.md` et `content-factory-backlog.md`. Les agents reviewers / planner / tdd-guide sont disponibles via la config globale `~/.claude`.

## Sécurité — note walking skeleton

Au skeleton (pas d'auth), **RLS désactivée** sur `communications` et `posts` : la clé publishable peut lire/écrire ces tables. Trou **volontaire et documenté**, fermé avec l'arrivée de l'auth (Epic 1 : RLS + policies par workspace).

## graphify

Graphe de connaissance dans `graphify-out/` (non versionné — reconstruit localement).

**Avant d'explorer le code :** lire `graphify-out/GRAPH_REPORT.md`, puis `/graphify query "<question>"` pour les questions transverses.

**Après changements :**
- Commits de code → hook post-commit relance l'extraction AST (sans LLM)
- Docs / nouvelles features → `/graphify . --update` manuellement
