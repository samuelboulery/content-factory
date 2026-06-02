import type { Workspace } from "./types";

/** Overlay de charte spécifique à un réseau pour ce workspace (US-2.5). */
export function getNetworkCharter(
  workspace: Workspace,
  network: string,
): string {
  const overlay = workspace.network_charters?.[network];
  return typeof overlay === "string" ? overlay.trim() : "";
}

/**
 * Fusionne la charte de base avec l'overlay réseau (si présent).
 * L'overlay est ajouté en complément, la charte de base reste prioritaire.
 */
export function mergeNetworkCharter(
  base: string,
  overlay: string,
  network: string,
): string {
  if (!overlay.trim()) return base;
  return `${base}\n\n<charte_specifique_reseau reseau="${network}">\n${overlay.trim()}\n</charte_specifique_reseau>`;
}
