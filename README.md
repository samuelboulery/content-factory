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
- **Supabase** (Postgres) — `@supabase/supabase-js`
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

Le schéma est dans `supabase-schema.sql` (tables `communications` + `posts`).
Il a déjà été appliqué sur le projet Supabase via MCP. Pour le rejouer sur un autre
projet : coller le contenu de `supabase-schema.sql` dans le SQL Editor du dashboard
Supabase, ou via la CLI Supabase.

> **Sécurité (walking skeleton)** : RLS est **désactivée** sur les 2 tables (pas d'auth
> au MVP). Avec la clé publishable, n'importe qui peut lire/écrire ces tables. Trou
> volontaire et documenté, à fermer avec l'auth (RLS + policies par workspace).

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

1. `npm run dev`, ouvrir http://localhost:3000
2. Cliquer **Nouvelle communication**
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
