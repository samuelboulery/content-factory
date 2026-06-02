"use server";

import { isValid, parseISO } from "date-fns";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Édite les faits durs d'une communication (US-5.13).
 * Met à jour `facts_updated_at` → les posts publiés AVANT cette modif seront flaggés.
 */
export async function editCommunicationAction(formData: FormData) {
  const id = String(formData.get("communication_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "");
  const eventLocation = String(formData.get("event_location") ?? "").trim();
  const eventLink = String(formData.get("event_link") ?? "").trim();
  const intervenants = String(formData.get("intervenants_text") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!id) redirect("/");
  if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || !isValid(parseISO(eventDate))) {
    redirect(`/communications/${id}`);
  }

  const { error } = await supabase
    .from("communications")
    .update({
      name,
      event_date: eventDate,
      event_location: eventLocation || null,
      event_link: eventLink || null,
      intervenants_text: intervenants || null,
      facts_updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    console.error("[editCommunication]:", error);
    redirect(`/communications/${id}?error=1`);
  }

  redirect(`/communications/${id}`);
}
