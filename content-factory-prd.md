# Content Factory — PRD MVP

**Version** : 0.3 — User flow consolidé
**Date** : 01/06/2026
**Owner** : Sam Boulery
**Statut** : Recadré, user flow validé, test LLM bloquant avant développement

---

## Vision

Content Factory est un atelier de création éditoriale assisté par IA, multi-workspace, conçu pour les associations design lyonnaises (TDS, FoF Lyon) et leur président, ainsi que pour un usage personnel LinkedIn. Un même moteur sert deux contextes : workspace asso (multi-rédacteur potentiel) et workspace perso (mono-rédacteur). Il aligne le ton entre rédacteurs grâce à une **charte éditoriale versionnée et activable**, structure le rétroplanning de publication autour d'événements via des templates, et capture la matière des intervenants sans relances manuelles. Open source potentiel à terme si l'outil tient ses promesses sur 6 mois d'usage TDS réel.

## User flow (A → Z)

**0. Setup workspace (une fois).** Création workspace nommé → switcher type Slack → settings : contexte général, charte éditoriale, réseaux ciblés. TDS importe son `.skill`. Charte versionnée (append-only, rollback). Workspace perso = même moteur, mono-rédacteur.

**1. Collecte intervenants (in-app, asynchrone).** Form interne à token (`/intervenants/[token]`), sans auth, champs fixes. La matière arrive quand elle arrive — pas de blocage. Fallback : coller un Google Form externe.

**2. Démarrer une com.** Choix d'un template (Event → 4 posts datés / Post libre → 1 post). Le template porte, pour chaque post, une **intention narrative** et un **niveau d'info attendu**, pas qu'un offset de jours.

**3. Remplir la fiche.** Deux zones : faits durs (date, lieu, lien, format — jamais inventés par l'IA) et matière libre (intervenants, contexte). Validation avant génération.

**4. Génération chronologique et consciente.** Les posts sont générés en chaîne, chacun connaît les autres et son intention. Face au manque d'info, deux comportements :
- Manque **normal** à ce stade (ex : pas d'intervenants à J-30) → l'IA assume et change l'angle (save-the-date / teasing), ce n'est pas un trou.
- Manque **anormal** à ce stade (ex : pas d'intervenants à J-15) → `[À COMPLÉTER : x]`, jamais d'invention.
Génération différée native : J-30 peut sortir seul, les suivants s'enrichissent quand la matière arrive, tout reste cohérent.

**5. Revue et ajustement.** Cartes posts : contenu + date + "so what" + badge conformité. Actions : régénérer avec note / éditer à la main / accepter. La régénération injecte **toute la campagne** en contexte (posts publiés marqués comme tels : « ne contredis pas »). Historique des 3 dernières régénérations (rollback). Verdict par post : publié tel quel / édité / rejeté.

**6. Faits durs corrigeables + signal de divergence.** Un fait dur peut être corrigé même après qu'un post l'ait annoncé. Si un post **déjà publié** contient un fait devenu obsolète → flag « ⚠️ fait modifié depuis publication » pour rendre la divergence visible (la source de vérité ne ment jamais en silence).

**7. Publication manuelle.** Page récap → bouton Copier → collage LinkedIn à la main → marquer « publié ».

**8. Vue d'ensemble.** Dashboard liste des coms + calendrier mensuel des posts à publier.

## Proposition de valeur

> Pour les responsables com d'associations design qui jonglent entre rédacteurs multiples et calendriers d'événements flous, Content Factory est un atelier éditorial assisté par IA qui aligne le ton collectif via une charte versionnée et automatise les rétroplannings d'event, contrairement à FeedHive ou Publer qui se limitent à planifier des posts, parce qu'il intègre nativement charte éditoriale comme objet de première classe, templates d'événements et collecte intervenants dans un seul flux.

## Différentiateur clé

**Charte éditoriale versionnée + rétroplanning event natif.** FeedHive/Publer planifient des posts isolés. Content Factory génère le rétroplanning entier d'un événement, conforme à un ton collectif versionné et auditable.

La gratuité d'accès (un membre TDS contribue sans compte LLM individuel) reste un **argument d'adoption interne**, pas un différenciateur marché. Ne pas le mettre en avant dans le positionnement externe.

## Personas

### Principal — Responsable com d'asso design (Sam pour TDS)
- **Profil** : président/contributeur d'asso, rédige et coordonne plusieurs membres
- **Outils actuels** : Google Docs, Notion, à la main, parfois ChatGPT
- **Frictions** : ton inconsistant entre rédacteurs, rétroplanning improvisé, relances intervenants chronophages

### Secondaire — Personal brander LinkedIn (Sam pour son perso)
- **Profil** : pro qui veut maintenir une cadence régulière
- **Frictions** : irrégularité de publication, style flottant, manque de planification
- **Note archi** : ce persona = workspace mono-rédacteur. Même moteur, config différente. Pas un second produit.

## Jobs-to-be-done

| Code | Persona | JTBD |
|---|---|---|
| JTBD-1 | Asso | Aligner un ton éditorial collectif quand plusieurs rédacteurs contribuent |
| JTBD-2 | Asso | Cadrer un rétroplanning de publication avant un événement |
| JTBD-3 | Asso | Collecter la matière des intervenants sans relances manuelles |
| JTBD-4 | Perso | Maintenir une cadence régulière LinkedIn avec un style cohérent |

## Scope MVP — 5 features-pivots

1. **Multi-workspace owner-only** — création, switcher type Slack, settings
2. **Charte éditoriale versionnée + activable** — contexte général, ton, réseaux, import skill TDS existant, historique append-only
3. **Template Event + rétroplanning auto avec intention narrative** — chaque post = `{offset (J-30/15/5/1, paramétrable), intention narrative, niveau d'info attendu}`. (Archi data prévoit le concept de template générique dès le départ même si un seul est implémenté.)
4. **Génération IA conforme + garde-fous + boucle + édition** — DeepSeek V3 (sous réserve test sec), prompt charte, filtre "so what" intégré, anti-hallucination contextuelle (manque normal → change d'angle / manque anormal → `[À COMPLÉTER]`), génération chronologique consciente (toute la campagne en contexte), badge conformité auto, régénération avec note + historique, faits durs corrigeables avec flag de divergence
5. **Collecte intervenants in-app + calendrier + copy-paste manuel** — form interne à token, vue posts, statut publié/à publier, verdict qualité par post

### Hors MVP explicite

Permissions multi-users, création de templates custom, multi-agents conformité, stratégie de com IA (color hunting), form intervenants **configurable** (questions paramétrables, suggestions IA, relances — le form interne simple est au MVP), vue timeline par com, sponsor management, charte par réseau, publication API, vue annuelle, statistiques, **génération de visuels/images (texte only au MVP, visuel produit hors outil dans Figma)**.

## Walking skeleton

Workspace TDS hardcodé → charte en dur → form basique (event + date + lieu + lien + intervenants) → génération 4 posts DeepSeek avec anti-hallucination → cartes copy-paste.

**Pré-requis bloquant** : test sec LLM validé (voir roadmap, phase 0).

**Test grandeur nature** : prochaine com TDS (Talk 4 ou Apéro). Comparaison qualité posts générés vs écrits à la main, mesurée par % publié sans édition.

## Stack technique

| Brique | Choix |
|---|---|
| Frontend | Next.js 14+ (App Router) + Tailwind + shadcn/ui |
| Backend / DB / Auth | Supabase (Postgres + RLS + Auth + Edge Functions) |
| Hébergement front | Vercel Free |
| Hébergement back | Supabase Free |
| LLM | DeepSeek V3 (via Edge Function pour cacher la clé) — **sous réserve test sec phase 0**. Fallback Mistral si ton FR/TDS non tenu. |
| Form intervenants MVP | Google Form externe |
| Domaine | OVH ou Namecheap (~10 €/an) |

## Coûts MVP

**15-35 €/an total** (LLM ~5-20 €/an + domaine ~10 €/an). Tiers gratuits Vercel et Supabase suffisants pour l'usage MVP.

## Effort estimé

**80-150h sur 2-4 mois** en mode part-time avec Claude Code en assistant. Les stories qualité ajoutées sont toutes de complexité S, effort global stable.

## Critères qualité mesurables

Trois couches, du déterministe au subjectif.

### Couche 1 — Checks automatiques (code, coût zéro)
Badge conformité par post, calculé après génération :

| Règle charte | Check |
|---|---|
| Max 3 points d'exclamation | `count("!") <= 3` |
| Pas de superlatifs creux | liste noire (incroyable, génial, exceptionnel, magique…) |
| "On" collectif, pas "nous" | détection `\bnous\b` |
| Longueur 600-1200 car. | borne stricte |
| Pas de fait inventé | présence de `[À COMPLÉTER]` |
| Closing formula présente | match liste closings |

Score conformité = checks passés / total, affiché en %.

### Couche 2 — Auto-évaluation IA (filtre "so what")
Intégrée au prompt (pas d'agent séparé, respecte D7). L'IA évalue le bénéfice lecteur de chaque post et réécrit si flou. Le "so what" est stocké et affiché.

### Couche 3 — Verdict humain (donnée d'amélioration)
Sam tranche chaque post : **Publié tel quel / Édité / Rejeté**. Édition → diff stocké. Rejet → raison stockée.

## Critères de succès MVP

- [ ] 1 com TDS générée et publiée 100 % via Content Factory (Talk 4 idéalement)
- [ ] **Métrique pivot : % posts publiés sans édition** — cible 20 % au départ, courbe croissante vers >50 %
- [ ] Rétroplanning auto utilisé sans correction manuelle pour 3 events consécutifs
- [ ] 2e contributeur TDS capable de générer une com en autonomie (test multi-utilisateur léger)
- [ ] Zéro hallucination factuelle non flaggée sur 3 events (les trous apparaissent en `[À COMPLÉTER]`)
- [ ] Coût annuel total < 50 €

## Roadmap

| Phase | Période | Contenu |
|---|---|---|
| **Phase 0 (bloquant)** | Avant dev | Test sec LLM : 1 prompt, 1 vraie com TDS passée, comparaison DeepSeek vs manuel. Go/no-go. |
| **MVP (Now)** | 0-3 mois | 5 features-pivots + couches qualité, usage TDS + perso Sam |
| **V1 (Next)** | 3-6 mois | Permissions multi-users, templates custom, multi-agents conformité, stratégie IA, form natif intervenants, vue timeline, notifs email, boucle d'apprentissage charte (corpus de diffs) |
| **V2+ (Later)** | 6-12 mois | API LinkedIn/Meta publication auto, génération images IA, statistiques annuelles, agents repost/commentaires, **mise en open source** |

## Risques majeurs

| Risque | Gravité | Mitigation |
|---|---|---|
| Concurrence non testée (FeedHive, Publer) | 🔴 Haute | Décision assumée par owner, à réévaluer post-MVP |
| RLS Supabase mal configuré → fuite cross-workspace | 🔴 Haute | Tests systématiques avec 2 comptes différents |
| DeepSeek inconsistant sur le ton TDS | 🟡 Moyenne | **Test sec phase 0 bloquant**, fallback Mistral, base = skill TDS existant |
| Hallucination de faits pratiques | 🟡 Moyenne | Anti-hallucination prompt + champs faits durs séparés + `[À COMPLÉTER]` |
| Coût API qui dérape | 🟢 Faible | Rate limit (10 générations/h/user), historique régénérations borné à 3, monitoring |
| Maintenance long terme solo | 🟡 Moyenne | Code simple, peu de dépendances, doc dans le repo, pas de criticité prod |
| Données prompts TDS sur serveurs CN | 🟢 Faible | Communication publique, IP asso non sensible. (Fallback Mistral EU si bascule.) |

## Décisions clés actées

| # | Décision | Date |
|---|---|---|
| D1 | LLM = DeepSeek V3 (perf/prix vs Mistral), **conditionné au test sec phase 0** | 09/05/2026 |
| D2 | Pas d'API LinkedIn/Meta en MVP, copier-coller manuel | 09/05/2026 |
| D3 | Persona perso inclus dans le MVP (template "Post libre") | 09/05/2026 |
| D4 | Pas de multi-utilisateurs en MVP, owner unique | 09/05/2026 |
| D5 | Form intervenants = Google Form externe en MVP | 09/05/2026 |
| D6 | Stratégie de com IA (color hunting, jeux) reportée en V1 | 09/05/2026 |
| D7 | Multi-agents conformité reportés en V1, agent unique en MVP (so what intégré au prompt) | 09/05/2026 |
| D8 | Pas de criticité prod, fix manuel si bug | 09/05/2026 |
| D9 | Test concurrents FeedHive/Publer skipped (assumé) | 09/05/2026 |
| **D10** | **Charte versionnée (append-only) dès le MVP, pas V1** | 01/06/2026 |
| **D11** | **Texte only au MVP, génération de visuels hors scope** | 01/06/2026 |
| **D12** | **Test sec LLM bloquant avant tout développement** | 01/06/2026 |
| **D13** | **Métrique qualité pivot = % posts publiés sans édition** | 01/06/2026 |
| **D14** | **Archi data prévoit le concept de template générique, même si seul Event est implémenté au MVP** | 01/06/2026 |
| **D15** | **Form intervenants in-app à token (Option A simple) au MVP ; Google Form externe = fallback** | 01/06/2026 |
| **D16** | **Régénération = toute la campagne injectée en contexte (posts publiés marqués « ne pas contredire »)** | 01/06/2026 |
| **D17** | **Faits durs corrigeables après publication, avec flag de divergence visible sur les posts déjà sortis** | 01/06/2026 |
| **D18** | **Chaque post du template porte une intention narrative + un niveau d'info attendu ; manque normal → change d'angle, manque anormal → `[À COMPLÉTER]`** | 01/06/2026 |
| **D19** | **Génération différée native : un post peut sortir avant que toute la matière soit là (ex : J-30 save-the-date)** | 01/06/2026 |
