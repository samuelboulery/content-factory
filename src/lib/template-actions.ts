"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { saveTemplateSteps } from "@/lib/template-steps";
import type { EventStep } from "@/lib/types";

/** Enregistre le rétroplanning (offsets + intentions) du workspace actif (US-3.3). */
export async function saveTemplateStepsAction(formData: FormData) {
  const offsets = formData.getAll("offset_days").map((v) => Number(String(v)));
  const intentions = formData.getAll("intention").map((v) => String(v).trim());
  const infos = formData.getAll("info_required").map((v) => String(v).trim());

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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
  await saveTemplateSteps(supabase, active.id, steps);
  redirect("/settings");
}
