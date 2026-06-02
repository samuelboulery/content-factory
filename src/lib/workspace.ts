import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Workspace } from "./types";
import { TDS_CHARTER } from "./charter";
import { saveCharterVersion } from "./charter-versions";
import { DEFAULT_EVENT_STEPS, saveTemplateSteps } from "./template-steps";
import { createTemplate } from "./templates";

export const ACTIVE_WORKSPACE_COOKIE = "cf_active_workspace";

/** Workspaces dont l'utilisateur est membre (multi-user US-1.4). */
export async function listWorkspaces(
  supabase: SupabaseClient,
  userId: string,
): Promise<Workspace[]> {
  const { data: memberRows } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId);
  const ids = (memberRows ?? []).map((r) => r.workspace_id as string);
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from("workspaces")
    .select("*")
    .in("id", ids)
    .order("created_at", { ascending: true });
  return (data ?? []) as Workspace[];
}

export async function createWorkspace(
  supabase: SupabaseClient,
  name: string,
): Promise<Workspace> {
  // Fonction SECURITY DEFINER : crée le workspace + la ligne membre 'owner' (bootstrap).
  const { data: id, error } = await supabase.rpc("create_workspace", {
    p_name: name,
  });
  if (error || !id) {
    throw new Error(
      `Création du workspace échouée : ${error?.message ?? "inconnue"}`,
    );
  }
  const workspaceId = id as string;
  // Seed la charte v1 + un template "Event" par défaut (l'appelant est désormais owner).
  await saveCharterVersion(supabase, workspaceId, TDS_CHARTER);
  const template = await createTemplate(supabase, workspaceId, "Event");
  await saveTemplateSteps(supabase, template.id, workspaceId, DEFAULT_EVENT_STEPS);
  const { data } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .single();
  return data as Workspace;
}

/**
 * Résout le workspace actif (depuis le cookie) + liste tous les workspaces de l'owner.
 * `active` = null si l'utilisateur n'est membre d'aucun workspace (pas d'auto-création :
 * il en crée un explicitement ou rejoint via un lien d'invitation).
 */
export async function resolveActiveWorkspace(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ active: Workspace | null; all: Workspace[] }> {
  const all = await listWorkspaces(supabase, userId);
  if (all.length === 0) return { active: null, all };
  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const active = all.find((w) => w.id === activeId) ?? all[0];
  return { active, all };
}

/** Bloc contexte (contexte général + réseaux) injecté dans la génération. */
export function buildWorkspaceContext(workspace: Workspace): string {
  const parts: string[] = [];
  if (workspace.context?.trim()) parts.push(workspace.context.trim());
  if (workspace.networks.length > 0) {
    parts.push(`Réseaux cibles : ${workspace.networks.join(", ")}`);
  }
  return parts.join("\n");
}
