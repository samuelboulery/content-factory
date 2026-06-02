"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Soumission publique d'un intervenant (US-6.2).
 * Passe par la fonction Postgres security-definer `submit_intervenant`
 * (accessible à anon) — pas d'écriture directe sur la table.
 */
export async function submitIntervenantAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  const bio = String(formData.get("bio") ?? "");
  const message = String(formData.get("message") ?? "");

  if (!token || !name) redirect(`/intervenants/${token}?error=1`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_intervenant", {
    p_token: token,
    p_name: name,
    p_role: role,
    p_bio: bio,
    p_message: message,
  });

  if (error) redirect(`/intervenants/${token}?error=1`);
  redirect(`/intervenants/${token}?sent=1`);
}
