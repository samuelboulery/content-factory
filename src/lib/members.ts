import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkspaceMember = { user_id: string; email: string; role: string };
export type WorkspaceInvite = {
  token: string;
  role: string;
  expires_at: string;
};

/** Rôle de l'utilisateur dans un workspace (owner/editor/viewer), null si non-membre. */
export async function getWorkspaceRole(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  return ((data?.role as string | undefined) ?? null) || null;
}

/** Membres du workspace avec leur email (via fonction SECURITY DEFINER). */
export async function listMembers(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<WorkspaceMember[]> {
  const { data } = await supabase.rpc("list_workspace_members", {
    p_ws: workspaceId,
  });
  return (data ?? []) as WorkspaceMember[];
}

/** Invitations en attente (non acceptées, non expirées). Owner uniquement (RLS). */
export async function listPendingInvites(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<WorkspaceInvite[]> {
  const { data } = await supabase
    .from("workspace_invites")
    .select("token, role, expires_at")
    .eq("workspace_id", workspaceId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  return (data ?? []) as WorkspaceInvite[];
}
