# Content Factory — Backlog MVP

**Version** : 0.3 — user flow consolidé
**Format** : User stories au format *"En tant que [persona], je veux [action] afin de [bénéfice]"*

**Légende priorité** :
- 🟥 **Must** (MVP)
- 🟧 **Should** (V1)
- 🟨 **Could** (V1+)
- ⬜ **Won't** (V2+)

**Légende complexité** :
- **S** : < 8h
- **M** : 8-30h
- **L** : 30-80h
- **XL** : 80h+

---

## Epic 0 — Validation préalable (bloquant)

| ID | Prio | Cplx | User story |
|---|---|---|---|
| US-0.1 | 🟥 | S | En tant qu'owner, je veux **valider que le LLM tient le ton TDS via un test sec** (1 prompt, 1 com TDS passée, comparaison vs manuel) afin de décider DeepSeek vs Mistral **avant** de construire |

## Epic 1 — Workspaces & permissions

| ID | Prio | Cplx | User story |
|---|---|---|---|
| US-1.1 | 🟥 | S | En tant qu'utilisateur, je veux **créer un workspace nommé** afin de séparer mes contextes (asso A, asso B, perso) |
| US-1.2 | 🟥 | S | En tant qu'utilisateur connecté, je veux **voir mes workspaces dans une barre latérale type Slack** afin de switcher rapidement |
| US-1.3 | 🟥 | S | En tant qu'owner d'un workspace, je veux **accéder à une page settings** afin de configurer la charte et les templates |
| US-1.4 | 🟧 | M | En tant qu'owner, je veux **inviter un autre user avec un rôle (editor/viewer)** afin de collaborer *(dégradée en Should : pas de multi-user MVP — D4)* |
| US-1.5 | 🟨 | M | En tant qu'editor d'un workspace, je veux **créer des coms mais pas modifier la charte** afin de respecter la gouvernance |

## Epic 2 — Charte éditoriale & contexte

| ID | Prio | Cplx | User story |
|---|---|---|---|
| US-2.1 | 🟥 | S | En tant qu'owner, je veux **saisir un contexte général sur mon asso/projet** afin que l'IA comprenne le périmètre |
| US-2.2 | 🟥 | S | En tant qu'owner, je veux **saisir une charte éditoriale (à qui, comment, ton)** afin que l'IA respecte ma voix |
| US-2.3 | 🟥 | S | En tant qu'owner, je veux **choisir les réseaux sociaux du workspace (LinkedIn, Instagram, etc.)** afin de cadrer les sorties |
| US-2.4 | 🟥 | S | En tant qu'owner TDS, je veux **importer ma charte depuis mon skill `.skill` existant** afin de gagner du temps de saisie |
| US-2.5 | 🟧 | M | En tant qu'owner, je veux **ajouter une charte spécifique par réseau** afin d'adapter le ton (LinkedIn vs Instagram) |
| **US-2.6** | 🟥 | S | En tant qu'owner, je veux **que ma charte soit versionnée (append-only, historique consultable)** afin de rollback si un rédacteur casse le ton |

## Epic 3 — Templates de communication

| ID | Prio | Cplx | User story |
|---|---|---|---|
| US-3.1 | 🟥 | M | En tant qu'owner, je veux **un template "Event" où chaque post porte une intention narrative + un niveau d'info attendu** (J-30 save-the-date, J-15 approfondissement, J-5 pratique, J-1 rappel) afin que l'IA adapte l'angle selon la matière disponible *(data : `{offset, intention, info_required}`, prévoit le concept générique — D14, D18)* |
| US-3.2 | 🟥 | S | En tant qu'owner, je veux **disposer d'un template "Post libre"** afin de créer un post ponctuel hors événement |
| US-3.3 | 🟥 | M | En tant qu'owner, je veux **paramétrer le rétroplanning d'un template (J-30, J-15, J-5, J-1)** afin d'adapter au type d'événement |
| US-3.4 | 🟧 | L | En tant qu'owner, je veux **créer un template custom** afin de gérer un nouveau type de com |
| US-3.5 | 🟨 | S | En tant qu'owner, je veux **indiquer si le template a un sponsor (requis/optionnel/aucun)** afin que l'IA en tienne compte |
| US-3.6 | 🟨 | S | En tant qu'owner, je veux **ajouter des guidelines complémentaires par template** afin d'affiner les sorties |

## Epic 4 — Création d'une communication

| ID | Prio | Cplx | User story |
|---|---|---|---|
| US-4.1 | 🟥 | S | En tant qu'utilisateur, je veux **choisir un template au démarrage d'une com** afin de structurer la suite |
| US-4.2 | 🟥 | M | En tant qu'utilisateur, je veux **remplir un formulaire (généré depuis le template) avec les infos clés**, dont **des champs de faits durs séparés (date, lieu, lien, format)** afin que l'IA n'invente jamais ces faits |
| US-4.3 | 🟥 | S | En tant qu'utilisateur, je veux **saisir les intervenants en texte libre dans le formulaire** afin d'avoir leur matière sans Google Form |
| US-4.4 | 🟥 | S | En tant qu'utilisateur, je veux **valider la fiche complète avant génération** afin de m'assurer que tout est correct |
| US-4.5 | 🟧 | L | En tant qu'utilisateur, je veux **générer un lien partageable de formulaire intervenants** afin qu'ils remplissent eux-mêmes |

## Epic 5 — Génération IA

| ID | Prio | Cplx | User story |
|---|---|---|---|
| US-5.1 | 🟥 | M | En tant qu'utilisateur, je veux **que l'IA génère un set de posts conformes à ma charte et au rétroplanning** afin de gagner 80 % du temps de rédaction |
| US-5.2 | 🟥 | S | En tant qu'utilisateur, je veux **régénérer un post avec une note ("plus court", "plus humour")**, l'IA recevant **toute la campagne en contexte** (posts publiés marqués « ne pas contredire ») afin d'ajuster sans casser la cohérence |
| US-5.3 | 🟥 | S | En tant qu'utilisateur, je veux **éditer manuellement le contenu d'un post** afin de fignoler |
| US-5.4 | 🟧 | M | En tant qu'utilisateur avec plusieurs coms en cours, je veux **que l'IA positionne les posts dans le calendrier en évitant les chevauchements** afin d'avoir une cadence cohérente *(dégradée en Should : logique non spécifiée, peu d'events simultanés au départ)* |
| US-5.5 | 🟧 | M | En tant qu'utilisateur, je veux **qu'un agent relecteur vérifie la conformité à ma charte avant de me proposer le post** afin de réduire les erreurs |
| US-5.6 | 🟨 | L | En tant qu'utilisateur, je veux **que l'IA me propose une stratégie de com (color hunting, jeu, teasing)** afin de sortir du format "post simple" |
| **US-5.7** | 🟥 | S | En tant qu'utilisateur, je veux **un badge de conformité auto par post** (exclamations, superlatifs, "nous", longueur, closing) afin de repérer les écarts charte sans relire |
| **US-5.8** | 🟥 | S | En tant qu'utilisateur, je veux **une anti-hallucination contextuelle** : manque **normal** à ce stade (ex : intervenants à J-30) → l'IA change d'angle (save-the-date), manque **anormal** → `[À COMPLÉTER : x]`, jamais d'invention de fait |
| **US-5.9** | 🟥 | S | En tant qu'utilisateur, je veux **trancher chaque post (publié tel quel / édité / rejeté)** afin de mesurer la qualité réelle (% publié sans édition) |
| **US-5.10** | 🟧 | S | En tant qu'utilisateur, je veux **garder l'historique des 3 dernières régénérations** d'un post afin de rollback et borner le coût |
| **US-5.11** | 🟥 | S | En tant qu'utilisateur, je veux **générer les posts en chaîne chronologique** (chaque post connaît les autres et son intention narrative) afin d'avoir une progression cohérente, pas 4 variations du même post |
| **US-5.12** | 🟥 | S | En tant qu'utilisateur, je veux **générer un post même sans toute la matière** (ex : J-30 save-the-date), les autres s'enrichissant plus tard, afin de ne pas être bloqué par des intervenants en retard |
| **US-5.13** | 🟥 | S | En tant qu'utilisateur, je veux **corriger un fait dur après publication et voir un flag « ⚠️ fait modifié depuis publication »** sur les posts déjà sortis afin que la divergence ne soit jamais silencieuse |

## Epic 6 — Intervenants externes

| ID | Prio | Cplx | User story |
|---|---|---|---|
| US-6.1 | 🟧 | S | En tant qu'utilisateur, je veux **coller manuellement les réponses d'un Google Form externe** afin de capturer la matière intervenants en fallback si le form interne coince *(dégradée en Should : le form interne MVP la remplace)* |
| US-6.2 | 🟥 | M | En tant qu'utilisateur, je veux **un form intervenants interne à token (`/intervenants/[token]`, champs fixes, sans auth)** afin que les intervenants remplissent eux-mêmes, tout restant dans Content Factory *(version simple — Option A)* |
| US-6.3 | 🟨 | M | En tant qu'utilisateur, je veux **que l'IA suggère des questions aux intervenants en fonction du contexte** afin d'affiner la matière |
| US-6.4 | ⬜ | M | En tant qu'utilisateur, je veux **que l'IA relise les réponses des intervenants pour repérer les manques** afin de relancer si besoin |

## Epic 7 — Calendrier & dashboard

| ID | Prio | Cplx | User story |
|---|---|---|---|
| US-7.1 | 🟥 | S | En tant qu'utilisateur, je veux **voir la liste des coms en cours sur mon dashboard** afin d'avoir une vue d'ensemble |
| US-7.2 | 🟥 | M | En tant qu'utilisateur, je veux **voir un calendrier mensuel avec tous les posts à publier** afin d'identifier la charge |
| US-7.3 | 🟧 | M | En tant qu'utilisateur, je veux **voir une timeline par communication** afin de visualiser le rétroplanning d'un événement spécifique |
| US-7.4 | 🟨 | S | En tant qu'utilisateur, je veux **exporter le calendrier en ICS/CSV** afin de le partager |
| US-7.5 | ⬜ | M | En tant qu'utilisateur, je veux **une vue annuelle avec stats (nb d'events, types de com)** afin de faire un bilan |

## Epic 8 — Brouillons & publication manuelle

| ID | Prio | Cplx | User story |
|---|---|---|---|
| US-8.1 | 🟥 | S | En tant qu'utilisateur, je veux **ouvrir une page récap d'un post avec un bouton "copier"** afin de coller dans LinkedIn manuellement |
| US-8.2 | 🟥 | S | En tant qu'utilisateur, je veux **marquer un post comme "publié"** afin de suivre l'avancement |
| US-8.3 | 🟧 | S | En tant qu'utilisateur, je veux **recevoir une notification email le matin d'un post à publier** afin de ne rien oublier |

---

## Récap MVP

**Must-have (🟥)** = scope minimum à livrer.

**Décomposition par epic** :
- E0 (validation) : 1 story Must bloquante
- E1 (workspaces) : 3 stories Must
- E2 (charte) : 5 stories Must (+ versioning)
- E3 (templates) : 3 stories Must (dont template Event avec intention narrative)
- E4 (création com) : 4 stories Must
- E5 (génération IA) : 10 stories Must (+ conformité, anti-hallucination contextuelle, verdict, génération chaînée, différée, flag divergence)
- E6 (intervenants) : 1 story Must (form interne à token ; Google Form = fallback Should)
- E7 (calendrier) : 2 stories Must
- E8 (publication) : 2 stories Must

**Changements vs v0.2** :
- US-6.2 (form interne à token) passée en Must, US-6.1 (Google Form) dégradée en Should/fallback
- US-3.1 enrichie : intention narrative + niveau d'info par post
- US-5.2 enrichie : toute la campagne en contexte à la régénération
- US-5.8 enrichie : anti-hallucination **contextuelle** (manque normal → change d'angle)
- 3 stories ajoutées (US-5.11 génération chaînée, US-5.12 génération différée, US-5.13 flag divergence faits durs)

Toutes les stories ajoutées sont en complexité S/M. **Effort global : ~90-160h part-time avec Claude Code** (form interne ajoute ~M vs Google Form).

---

## Ordre de développement recommandé

0. **Test sec LLM** (US-0.1) — go/no-go bloquant
1. **Walking skeleton** (charte hardcodée + template event avec intentions + form faits durs + génération chaînée US-5.11 + anti-hallucination contextuelle US-5.8 + génération différée US-5.12 + copy-paste US-8.1)
2. **Auth + multi-workspace** (US-1.1, US-1.2, US-1.3)
3. **Charte configurable + versioning** (US-2.1, US-2.2, US-2.3, US-2.6)
4. **Rétroplanning + intentions paramétrables** (US-3.3, US-3.1)
5. **Form intervenants interne à token** (US-6.2)
6. **Boucle régénération (campagne en contexte) + édition + historique + verdict + flag divergence** (US-5.2, US-5.3, US-5.10, US-5.9, US-5.13)
7. **Conformité + calendrier + statuts** (US-5.7, US-7.1, US-7.2, US-8.2)
8. **Polish + tests grandeur nature TDS Talk 4** (mesure % publié sans édition)
