/** Validation basique d'adresse email (suffisante au stade). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parse une saisie libre (séparée par virgules, points-virgules ou retours
 * ligne) en liste d'emails valides, normalisés (minuscule) et dédupliqués.
 */
export function parseEmails(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\n,;]+/)) {
    const email = part.trim().toLowerCase();
    if (email && EMAIL_RE.test(email) && !seen.has(email)) {
      seen.add(email);
      out.push(email);
    }
  }
  return out;
}
