import type { SupabaseClient } from "@supabase/supabase-js";
import type { Template } from "./types";

/** Templates du workspace (US-3.4). */
export async function listTemplates(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<Template[]> {
  const { data } = await supabase
    .from("templates")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  return (data ?? []) as Template[];
}

/** Crée un template nommé. @returns le template créé. */
export async function createTemplate(
  supabase: SupabaseClient,
  workspaceId: string,
  name: string,
): Promise<Template> {
  const { data, error } = await supabase
    .from("templates")
    .insert({ workspace_id: workspaceId, name })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Création du template échouée : ${error?.message ?? "inconnue"}`);
  }
  return data as Template;
}

/** Supprime un template (cascade ses steps). */
export async function deleteTemplate(
  supabase: SupabaseClient,
  templateId: string,
): Promise<void> {
  await supabase.from("templates").delete().eq("id", templateId);
}
