# Content Factory

Atelier de création éditoriale assisté par IA pour **The Design Society (TDS)**.
À partir des faits durs d'un événement (nom, date, lieu, lien) et de la matière libre
sur les intervenants, l'outil génère **4 posts LinkedIn en chaîne chronologique**
(J-30 / J-15 / J-5 / J-1), conformes à la charte éditoriale TDS, avec anti-hallucination
contextuelle et badge de conformité automatique.

> État : **walking skeleton** (TDS hardcodé, pas d'auth, texte only). Voir
> `content-factory-prd.md` et `content-factory-backlog.md` pour la vision complète.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript strict**
- **Tailwind CSS v4** + **shadcn/ui**
- **Supabase** (Postgres + Auth magic link) — `@supabase/supabase-js` + `@supabase/ssr`
- **DeepSeek** (`deepseek-chat`) — appelé uniquement côté serveur
- **date-fns** (locale `fr`)

## Prérequis

- Node.js ≥ 20 (testé en 22)
- Un projet **Supabase** (déjà provisionné : `content-factory`, eu-west-3)
- Une clé API **DeepSeek**

## Installation

```bash
npm install
```

### Variables d'environnement

Copier l'exemple puis renseigner les valeurs :

```bash
cp .env.local.example .env.local
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publishable Supabase |
| `DEEPSEEK_API_KEY` | Clé API DeepSeek (**serveur uniquement, jamais exposée**) |

> `.env.local` n'est jamais commité. La clé DeepSeek doit y être ajoutée à la main.

### Base de données

Le schéma est dans `supabase-schema.sql` (tables `workspaces`, `communications`, `posts`).
Il a déjà été appliqué sur le projet Supabase via MCP. Pour le rejouer sur un autre
projet : coller le contenu de `supabase-schema.sql` dans le SQL Editor du dashboard
Supabase, ou via la CLI Supabase.

> **Sécurité** : RLS est **activée** sur les 3 tables, avec des policies owner-scoped
> (`auth.uid()`). Chaque utilisateur ne voit que les données de ses workspaces.

### Authentification

Connexion par **magic link** (Supabase Auth). Au 1er login, un workspace
« The Design Society » est créé pour l'utilisateur. Tout est protégé par un middleware
(redirection vers `/login` si non connecté).

**Multi-workspace** : barre latérale type Slack pour switcher entre workspaces et en
créer de nouveaux (champ « Nouveau workspace »). Le workspace actif (cookie
`cf_active_workspace`) scope les communications affichées et créées.

**Charte éditoriale versionnée** : éditable par workspace dans `/settings`. Chaque
enregistrement crée une nouvelle version (append-only) ; l'historique permet de
restaurer une version antérieure. La génération utilise la charte active du workspace
(la constante `TDS_CHARTER` sert de version 1 par défaut). Table `charter_versions`.

**Config Supabase requise** (dashboard → Authentication → URL Configuration) :
- **Site URL** : `http://localhost:3000` (en dev)
- **Redirect URLs** : ajouter `http://localhost:3000/**`

Sans cette config, le lien magique ne pourra pas rediriger vers l'app.

## Lancer en dev

```bash
npm run dev
```

→ http://localhost:3000

## Vérification

```bash
npm run lint        # ESLint
npx tsc --noEmit    # types stricts
npm run build       # build production
```

## Test end-to-end

1. `npm run dev`, ouvrir http://localhost:3000 → redirection vers `/login`
2. Saisir un e-mail → recevoir le lien magique → cliquer → retour sur l'accueil connecté
3. Cliquer **Nouvelle communication**
3. Remplir un événement (nom + date requis ; lieu / lien / intervenants optionnels)
4. **Générer 4 posts** → redirection vers `/communications/[id]`
5. Vérifier les 4 cartes : contenu FR cohérent (J-30 save-the-date → J-1 rappel),
   date FR, « so what », badge de conformité, bouton **Copier**
6. Test anti-hallucination : laisser le lieu vide → un post de détails pratiques (J-5)
   doit afficher `[À COMPLÉTER : lieu]` plutôt qu'inventer ; le J-30 sans intervenants
   doit partir en teasing assumé (pas de `[À COMPLÉTER]`)

## Structure

```
src/
├── app/
│   ├── page.tsx                       # Accueil
│   ├── communications/new/page.tsx    # Formulaire (client)
│   ├── communications/[id]/page.tsx   # Cartes posts (server)
│   └── api/generate/route.ts          # POST : génération + insertion DB
├── components/
│   ├── PostCard.tsx                   # Carte post (client) : badge + Copier
│   └── ui/                            # shadcn/ui
└── lib/
    ├── charter.ts                     # Charte éditoriale TDS (constante)
    ├── supabase.ts                    # Client Supabase + types
    ├── llm.ts                         # generatePosts() — DeepSeek + parsing défensif
    └── compliance.ts                  # checkCompliance() — badge déterministe
```
