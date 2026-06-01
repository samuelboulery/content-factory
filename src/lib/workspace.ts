import type { SupabaseClient } from "@supabase/supabase-js";
import type { Workspace } from "./types";

const TDS_WORKSPACE_NAME = "The Design Society";

/**
 * Renvoie le workspace de l'utilisateur, le crée s'il n'existe pas.
 * Slice mince : un seul workspace TDS par owner (pas encore de multi-workspace).
 */
export async function getOrCreateTdsWorkspace(
  supabase: SupabaseClient,
  userId: string,
): Promise<Workspace> {
  const { data: existing } = await supabase
    .from("workspaces")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) return existing as Workspace;

  const { data: created, error } = await supabase
    .from("workspaces")
    .insert({ name: TDS_WORKSPACE_NAME, owner_id: userId })
    .select("*")
    .single();

  if (error || !created) {
    throw new Error(
      `Création du workspace échouée : ${error?.message ?? "inconnue"}`,
    );
  }
  return created as Workspace;
}
