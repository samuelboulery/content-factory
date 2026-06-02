"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveWorkspace } from "@/lib/workspace";
import {
  listCharterVersions,
  saveCharterVersion,
} from "@/lib/charter-versions";
import { parseSkillCharter, MAX_SKILL_BYTES } from "@/lib/skill-import";

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
  if (!active) redirect("/");
  await saveCharterVersion(supabase, active.id, content);
  redirect("/settings");
}

/** Importe une charte depuis un fichier `.skill` → nouvelle version (US-2.4). */
export async function importCharterAction(formData: FormData) {
  const file = formData.get("file");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!(file instanceof File) || file.size === 0) {
    redirect("/settings?importError=empty");
  }
  if (file.size > MAX_SKILL_BYTES) {
    redirect("/settings?importError=size");
  }

  const content = parseSkillCharter(await file.text());
  if (!content) redirect("/settings?importError=empty");

  const { active } = await resolveActiveWorkspace(supabase, user.id);
  if (!active) redirect("/");
  await saveCharterVersion(supabase, active.id, content);
  redirect("/settings?imported=1");
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
  if (!active) redirect("/");
  const versions = await listCharterVersions(supabase, active.id);
  const target = versions.find((v) => v.id === versionId);
  if (target) {
    await saveCharterVersion(supabase, active.id, target.content);
  }
  redirect("/settings");
}
