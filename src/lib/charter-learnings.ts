import type { SupabaseClient } from "@supabase/supabase-js";
import type { CharterLearning } from "./types";

/** Dernière analyse d'apprentissage de la charte pour ce workspace (owner only via RLS). */
export async function getLatestLearning(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<CharterLearning | null> {
  const { data } = await supabase
    .from("charter_learnings")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as CharterLearning | null) ?? null;
}
