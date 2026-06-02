import type { SupabaseClient } from "@supabase/supabase-js";
import { TDS_CHARTER } from "./charter";
import type { CharterVersion } from "./types";

/**
 * Charte active d'un workspace = version la plus haute.
 * Fallback sur la constante TDS_CHARTER si aucune version (workspace pré-versioning).
 */
export async function getActiveCharter(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<{ content: string; version: number | null }> {
  const { data } = await supabase
    .from("charter_versions")
    .select("content, version")
    .eq("workspace_id", workspaceId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data) {
    return {
      content: data.content as string,
      version: data.version as number,
    };
  }
  return { content: TDS_CHARTER, version: null };
}

export async function listCharterVersions(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<CharterVersion[]> {
  const { data } = await supabase
    .from("charter_versions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("version", { ascending: false });
  return (data ?? []) as CharterVersion[];
}

/**
 * Ajoute une nouvelle version de charte (append-only).
 * @returns le numéro de la version créée.
 */
export async function saveCharterVersion(
  supabase: SupabaseClient,
  workspaceId: string,
  content: string,
): Promise<number> {
  const { data: latest } = await supabase
    .from("charter_versions")
    .select("version")
    .eq("workspace_id", workspaceId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = ((latest?.version as number | undefined) ?? 0) + 1;

  const { error } = await supabase
    .from("charter_versions")
    .insert({ workspace_id: workspaceId, content, version: nextVersion });

  if (error) {
    throw new Error(`Sauvegarde de la charte échouée : ${error.message}`);
  }
  return nextVersion;
}
