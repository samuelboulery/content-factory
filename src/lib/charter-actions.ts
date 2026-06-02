"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveWorkspace } from "@/lib/workspace";
import {
  listCharterVersions,
  saveCharterVersion,
} from "@/lib/charter-versions";

/** Enregistre une nouvelle version de la charte du workspace actif. */
export async function saveCharterAction(formData: FormData) {
  const content = String(formData.get("content") ?? "").trim();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!content) redirect("/settings");

  const { active } = await resolveActiveWorkspace(supabase, user.id);
  await saveCharterVersion(supabase, active.id, content);
  redirect("/settings");
}

/** Restaure une version antérieure (= la ré-ajoute en tête, append-only). */
export async function rollbackCharterAction(formData: FormData) {
  const versionId = String(formData.get("version_id") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { active } = await resolveActiveWorkspace(supabase, user.id);
  const versions = await listCharterVersions(supabase, active.id);
  const target = versions.find((v) => v.id === versionId);
  if (target) {
    await saveCharterVersion(supabase, active.id, target.content);
  }
  redirect("/settings");
}
