---
description: Vérifie le projet — lint + types + build
---

# /verify

Lance la vérification complète du projet, dans cet ordre, et s'arrête au premier échec en expliquant la cause en français :

1. `npm run lint` — ESLint
2. `npx tsc --noEmit` — vérification de types stricte (aucun `any` non justifié toléré)
3. `npm run build` — build Next.js de production

Si une étape échoue : afficher la sortie d'erreur exacte, diagnostiquer la cause, proposer un fix minimal. Ne pas enchaîner les étapes suivantes tant que l'étape courante n'est pas verte.

Si tout passe : confirmer « ✅ lint + types + build OK » avec un récap d'une ligne par étape.
