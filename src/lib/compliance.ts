/**
 * Vérification de conformité éditoriale — déterministe, ZÉRO appel IA.
 * 4 checks scorés (binaires) + 2 infos (n'affectent pas le score).
 */

export type ComplianceResult = {
  score: number; // 0-100, % de checks scorés passés
  violations: string[]; // règles enfreintes
  infos: string[]; // signaux non bloquants (trou factuel, closing absente)
};

const HOLLOW_SUPERLATIVES = ['incroyable', 'génial', 'exceptionnel', 'magique', 'ouf', 'dingue'];
// Issues de la charte (closing formulas habituelles), normalisées en minuscules.
const CLOSING_FORMULAS = ['on se voit là-bas', 'à très vite', 'hâte de vous y voir'];

const MAX_EXCLAMATIONS = 3;
const MIN_LENGTH = 600;
const MAX_LENGTH = 1200;

export function checkCompliance(content: string): ComplianceResult {
  const violations: string[] = [];
  const infos: string[] = [];
  const lower = content.toLowerCase();

  // Check scoré 1 — exclamations <= 3
  const exclamations = (content.match(/!/g) ?? []).length;
  const passExclamations = exclamations <= MAX_EXCLAMATIONS;
  if (!passExclamations) violations.push("Plus de 3 points d'exclamation");

  // Check scoré 2 — aucun superlatif creux
  const foundSuperlatives = HOLLOW_SUPERLATIVES.filter((word) => lower.includes(word));
  const passSuperlatives = foundSuperlatives.length === 0;
  for (const word of foundSuperlatives) {
    violations.push(`Superlatif creux détecté : ${word}`);
  }

  // Check scoré 3 — pas de "nous" (le ton est "on")
  const passNous = !/\bnous\b/i.test(content);
  if (!passNous) violations.push("'Nous' détecté (utiliser 'on')");

  // Check scoré 4 — longueur 600-1200
  const length = content.length;
  const passLength = length >= MIN_LENGTH && length <= MAX_LENGTH;
  if (!passLength) violations.push(`Longueur hors borne (${length} car.)`);

  const scoredChecks = [passExclamations, passSuperlatives, passNous, passLength];
  const passed = scoredChecks.filter(Boolean).length;
  const score = Math.round((passed / scoredChecks.length) * 100);

  // Info 1 — trou factuel assumé (pas une violation)
  if (content.includes('[À COMPLÉTER')) infos.push('Trou factuel à compléter');

  // Info 2 — closing formula de la charte présente ?
  const hasClosing = CLOSING_FORMULAS.some((formula) => lower.includes(formula));
  if (!hasClosing) infos.push('Pas de closing formula habituelle');

  return { score, violations, infos };
}
