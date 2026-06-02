import { addDays, format } from "date-fns";

/** Fenêtre max de décalage pour éviter une collision (au-delà : on tolère). */
export const MAX_SHIFT_DAYS = 30;

/**
 * Renvoie le jour libre le plus proche de `base` absent de `occupied`
 * (anti-chevauchement, US-5.4). À distance égale, **préfère le jour plus tôt**
 * (rester avant l'événement). Renvoie yyyy-MM-dd.
 */
export function findFreeDate(
  base: Date,
  occupied: ReadonlySet<string>,
): string {
  for (let delta = 0; delta <= MAX_SHIFT_DAYS; delta += 1) {
    const signs = delta === 0 ? [0] : [-1, 1]; // -1 d'abord = préfère plus tôt
    for (const sign of signs) {
      const key = format(addDays(base, sign * delta), "yyyy-MM-dd");
      if (!occupied.has(key)) return key;
    }
  }
  return format(base, "yyyy-MM-dd"); // au-delà du cap : collision tolérée
}
