import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventStep } from "./types";

/** Rétroplanning Event par défaut (fallback + seed des nouveaux workspaces). */
export const DEFAULT_EVENT_STEPS: EventStep[] = [
  {
    offset_days: -30,
    intention:
      "SAVE THE DATE / teasing. Date + lieu suffisent ; les intervenants peuvent manquer (manque normal → teasing assumé, pas de [À COMPLÉTER]).",
    info_required: "date + lieu",
  },
  {
    offset_days: -15,
    intention:
      "Approfondissement contenu et intervenants. Si la matière intervenants manque → [À COMPLÉTER].",
    info_required: "matière intervenants",
  },
  {
    offset_days: -5,
    intention:
      "Rappel + détails pratiques. Si un fait dur manque → [À COMPLÉTER].",
    info_required: "tous les faits durs",
  },
  {
    offset_days: -1,
    intention: "Rappel jour J, urgence douce.",
    info_required: "tout",
  },
];

/** Étapes d'un template, ou le défaut si aucune n'est enregistrée (US-3.4). */
export async function getTemplateSteps(
  supabase: SupabaseClient,
  templateId: string,
): Promise<EventStep[]> {
  const { data } = await supabase
    .from("template_steps")
    .select("offset_days, intention, info_required")
    .eq("template_id", templateId)
    .order("position", { ascending: true });

  if (data && data.length > 0) {
    return data.map((row) => ({
      offset_days: row.offset_days as number,
      intention: row.intention as string,
      info_required: (row.info_required as string | null) ?? null,
    }));
  }
  return DEFAULT_EVENT_STEPS;
}

/** Remplace les étapes d'un template (overwrite : config, pas append-only). */
export async function saveTemplateSteps(
  supabase: SupabaseClient,
  templateId: string,
  workspaceId: string,
  steps: EventStep[],
): Promise<void> {
  await supabase.from("template_steps").delete().eq("template_id", templateId);
  const rows = steps.map((step, index) => ({
    template_id: templateId,
    workspace_id: workspaceId,
    position: index,
    offset_days: step.offset_days,
    intention: step.intention,
    info_required: step.info_required,
  }));
  const { error } = await supabase.from("template_steps").insert(rows);
  if (error) {
    throw new Error(`Sauvegarde du rétroplanning échouée : ${error.message}`);
  }
}
