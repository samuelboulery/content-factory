"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_WORKSPACE_COOKIE, resolveActiveWorkspace } from "@/lib/workspace";

const COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 365,
};

/** Crée une invitation (lien-token) pour le workspace actif. Owner uniquement (RLS). */
export async function createInviteAction(formData: FormData) {
  const requestedRole = String(formData.get("role") ?? "editor");
  const role = requestedRole === "viewer" ? "viewer" : "editor";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { active } = await resolveActiveWorkspace(supabase, user.id);
  if (!active) redirect("/");
  await supabase
    .from("workspace_invites")
    .insert({ workspace_id: active.id, role, created_by: user.id });
  redirect("/settings");
}

/** Révoque une invitation en attente. Owner uniquement (RLS). */
export async function revokeInviteAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("workspace_invites").delete().eq("token", token);
  redirect("/settings");
}

/** Retire un membre du workspace actif. Owner uniquement (RLS). Pas soi-même ni un owner. */
export async function removeMemberAction(formData: FormData) {
  const userId = String(formData.get("user_id") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { active } = await resolveActiveWorkspace(supabase, user.id);
  if (!active) redirect("/");
  if (userId && userId !== user.id) {
    await supabase
      .from("workspace_members")
      .delete()
      .eq("workspace_id", active.id)
      .eq("user_id", userId)
      .neq("role", "owner");
  }
  redirect("/settings");
}

/** Accepte une invitation (ajoute le membre via RPC) et bascule sur le workspace. */
export async function acceptInviteAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/invite/${token}`);

  const { data: wsId, error } = await supabase.rpc("accept_invite", {
    p_token: token,
  });
  if (error || !wsId) redirect(`/invite/${token}?error=1`);

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, wsId as string, COOKIE_OPTIONS);
  redirect("/");
}
