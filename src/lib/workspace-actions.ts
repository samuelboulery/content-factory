"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ACTIVE_WORKSPACE_COOKIE,
  createWorkspace,
  listWorkspaces,
  resolveActiveWorkspace,
} from "@/lib/workspace";

const COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 365, // 1 an
};

/** Change le workspace actif (vérifie que l'utilisateur le possède). */
export async function switchWorkspace(formData: FormData) {
  const id = String(formData.get("workspace_id") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const all = await listWorkspaces(supabase, user.id);
  if (all.some((w) => w.id === id)) {
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_WORKSPACE_COOKIE, id, COOKIE_OPTIONS);
  }
  redirect("/");
}

/** Crée un workspace nommé et le rend actif. */
export async function createWorkspaceAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!name) redirect("/");

  const workspace = await createWorkspace(supabase, user.id, name);
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspace.id, COOKIE_OPTIONS);
  redirect("/");
}

/** Contexte général + réseaux ciblés du workspace actif (US-2.1/2.3). */
export async function saveWorkspaceSettingsAction(formData: FormData) {
  const context = String(formData.get("context") ?? "").trim();
  const networks = formData.getAll("networks").map((value) => String(value));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { active } = await resolveActiveWorkspace(supabase, user.id);
  await supabase
    .from("workspaces")
    .update({ context: context || null, networks })
    .eq("id", active.id);
  redirect("/settings");
}
