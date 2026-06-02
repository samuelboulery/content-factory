import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Workspace } from "./types";
import { TDS_CHARTER } from "./charter";
import { saveCharterVersion } from "./charter-versions";
import { DEFAULT_EVENT_STEPS, saveTemplateSteps } from "./template-steps";

export const ACTIVE_WORKSPACE_COOKIE = "cf_active_workspace";
const DEFAULT_WORKSPACE_NAME = "The Design Society";

export async function listWorkspaces(
  supabase: SupabaseClient,
  userId: string,
): Promise<Workspace[]> {
  const { data } = await supabase
    .from("workspaces")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true });
  return (data ?? []) as Workspace[];
}

export async function createWorkspace(
  supabase: SupabaseClient,
  userId: string,
  name: string,
): Promise<Workspace> {
  const { data, error } = await supabase
    .from("workspaces")
    .insert({ name, owner_id: userId })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `Création du workspace échouée : ${error?.message ?? "inconnue"}`,
    );
  }
  const workspace = data as Workspace;
  // Seed la charte v1 + le rétroplanning Event par défaut, éditables via /settings.
  await saveCharterVersion(supabase, workspace.id, TDS_CHARTER);
  await saveTemplateSteps(supabase, workspace.id, DEFAULT_EVENT_STEPS);
  return workspace;
}

/**
 * Résout le workspace actif (depuis le cookie) + liste tous les workspaces de l'owner.
 * Crée le workspace TDS par défaut si l'utilisateur n'en a aucun.
 */
export async function resolveActiveWorkspace(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ active: Workspace; all: Workspace[] }> {
  let all = await listWorkspaces(supabase, userId);
  if (all.length === 0) {
    all = [await createWorkspace(supabase, userId, DEFAULT_WORKSPACE_NAME)];
  }
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
