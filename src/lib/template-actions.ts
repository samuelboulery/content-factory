"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { saveTemplateSteps } from "@/lib/template-steps";
import { createTemplate, deleteTemplate } from "@/lib/templates";
import type { EventStep } from "@/lib/types";

/** Enregistre les étapes (offsets + intentions) d'un template (US-3.3/3.4). */
export async function saveTemplateStepsAction(formData: FormData) {
  const templateId = String(formData.get("template_id") ?? "");
  const offsets = formData.getAll("offset_days").map((v) => Number(String(v)));
  const intentions = formData.getAll("intention").map((v) => String(v).trim());
  const infos = formData.getAll("info_required").map((v) => String(v).trim());

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!templateId) redirect("/settings");

  const steps: EventStep[] = [];
  for (let i = 0; i < intentions.length; i++) {
    const offset = offsets[i];
    const intention = intentions[i];
    if (!Number.isFinite(offset) || !intention) continue;
    steps.push({
      offset_days: Math.trunc(offset),
      intention,
      info_required: infos[i] || null,
    });
  }
  if (steps.length === 0) redirect("/settings");

  const { active } = await resolveActiveWorkspace(supabase, user.id);
  if (!active) redirect("/");
  await saveTemplateSteps(supabase, templateId, active.id, steps);
  redirect("/settings");
}

/** Crée un nouveau template nommé pour le workspace actif (US-3.4). */
export async function createTemplateAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!name) redirect("/settings");

  const { active } = await resolveActiveWorkspace(supabase, user.id);
  if (!active) redirect("/");
  await createTemplate(supabase, active.id, name);
  redirect("/settings");
}

/** Supprime un template (cascade ses étapes). Owner uniquement (RLS). */
export async function deleteTemplateAction(formData: FormData) {
  const templateId = String(formData.get("template_id") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await deleteTemplate(supabase, templateId);
  redirect("/settings");
}
