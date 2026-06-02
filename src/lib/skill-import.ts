/**
 * Import d'une charte depuis un fichier `.skill` (US-2.4).
 * Un `.skill` = markdown avec frontmatter YAML optionnel :
 *
 *   ---
 *   name: tds-charter
 *   description: ...
 *   ---
 *   <corps = la charte éditoriale>
 *
 * On retire le frontmatter (métadonnées, non pertinent pour la génération) et
 * on garde le corps markdown comme contenu de charte. Parsing défensif.
 */

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

/** Retire le frontmatter YAML d'entête s'il existe, renvoie le corps trimmé. */
export function parseSkillCharter(raw: string): string {
  // Retire un éventuel BOM puis le bloc frontmatter d'entête.
  const text = raw.replace(/^﻿/, "");
  const body = text.replace(FRONTMATTER_RE, "");
  return body.trim();
}

/** Taille max d'un fichier `.skill` accepté (garde-fou). */
export const MAX_SKILL_BYTES = 200_000;
