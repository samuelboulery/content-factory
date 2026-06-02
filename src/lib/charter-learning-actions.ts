"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { getActiveCharter, saveCharterVersion } from "@/lib/charter-versions";
import { analyzeCharterLearnings, type CharterDiff } from "@/lib/llm";

/** Analyse les corrections (édités+publiés) → propose un ajustement de charte (owner). */
export async function analyzeCharterAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { active } = await resolveActiveWorkspace(supabase, user.id);
  if (!active) redirect("/");

  // Corpus : posts publiés ET édités du workspace, où le brouillon IA diffère.
  const { data: commRows } = await supabase
    .from("communications")
    .select("id")
    .eq("workspace_id", active.id);
  const commIds = (commRows ?? []).map((c) => c.id as string);

  let diffs: CharterDiff[] = [];
  if (commIds.length > 0) {
    const { data: postRows } = await supabase
      .from("posts")
      .select("original_content, content")
      .in("communication_id", commIds)
      .eq("status", "published")
      .eq("edited", true)
      .limit(40);
    diffs = (postRows ?? [])
      .map((p) => ({
        ai: (p.original_content as string | null) ?? "",
        human: p.content as string,
      }))
      .filter((d) => d.ai && d.ai !== d.human)
      .slice(0, 20);
  }

  if (diffs.length === 0) redirect("/settings?learn=empty");

  const charter = (await getActiveCharter(supabase, active.id)).content;
  let result: { observations: string[]; addendum: string };
  try {
    result = await analyzeCharterLearnings(charter, diffs);
  } catch {
    redirect("/settings?learn=error");
  }

  await supabase.from("charter_learnings").delete().eq("workspace_id", active.id);
  await supabase.from("charter_learnings").insert({
    workspace_id: active.id,
    observations: result.observations,
    addendum: result.addendum || null,
    sample_size: diffs.length,
  });
  redirect("/settings?learn=done");
}

/** Applique l'addendum proposé → nouvelle version de charte (owner). */
export async function applyCharterLearningAction(formData: FormData) {
  const learningId = String(formData.get("learning_id") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { active } = await resolveActiveWorkspace(supabase, user.id);
  if (!active) redirect("/");

  const { data: learning } = await supabase
    .from("charter_learnings")
    .select("addendum")
    .eq("id", learningId)
    .maybeSingle();
  const addendum = ((learning?.addendum as string | null) ?? "").trim();
  if (addendum) {
    const charter = (await getActiveCharter(supabase, active.id)).content;
    const merged = `${charter}\n\n## Ajustements appris\n${addendum}`;
    await saveCharterVersion(supabase, active.id, merged);
  }
  await supabase.from("charter_learnings").delete().eq("id", learningId);
  redirect("/settings");
}

/** Ignore l'analyse en cours (owner). */
export async function dismissCharterLearningAction(formData: FormData) {
  const learningId = String(formData.get("learning_id") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await supabase.from("charter_learnings").delete().eq("id", learningId);
  redirect("/settings");
}
