"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveCharter } from "@/lib/charter-versions";
import { buildWorkspaceContext } from "@/lib/workspace";
import { suggestIntervenantQuestions, type EventFacts } from "@/lib/llm";
import type { Communication, Workspace } from "@/lib/types";

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
  const subject = String(formData.get("subject") ?? "");
  const link = String(formData.get("link") ?? "");

  if (!token || !name) redirect(`/intervenants/${token}?error=1`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_intervenant", {
    p_token: token,
    p_name: name,
    p_role: role,
    p_bio: bio,
    p_message: message,
    p_subject: subject,
    p_link: link,
  });

  if (error) redirect(`/intervenants/${token}?error=1`);
  redirect(`/intervenants/${token}?sent=1`);
}

type SubmissionMatter = {
  name: string;
  role: string | null;
  bio: string | null;
  message: string | null;
  subject: string | null;
  link: string | null;
  communication_id: string;
};

/**
 * Intègre une soumission intervenant dans la matière de la com (US-6.1 amélioré) :
 * append d'un extrait lisible dans `communications.intervenants_text`, le champ
 * que la génération lit réellement. Idempotent (n'ajoute pas deux fois le même).
 */
export async function addSubmissionToMatterAction(formData: FormData) {
  const communicationId = String(formData.get("communication_id") ?? "");
  const submissionId = String(formData.get("submission_id") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS : l'owner ne lit que les soumissions de ses communications.
  const { data: subData } = await supabase
    .from("intervenant_submissions")
    .select("name, role, bio, message, subject, link, communication_id")
    .eq("id", submissionId)
    .maybeSingle();
  const sub = subData as SubmissionMatter | null;
  if (!sub || sub.communication_id !== communicationId) {
    redirect(`/communications/${communicationId}`);
  }

  const { data: commData } = await supabase
    .from("communications")
    .select("intervenants_text")
    .eq("id", communicationId)
    .maybeSingle();
  const comm = commData as { intervenants_text: string | null } | null;
  if (!comm) redirect(`/communications/${communicationId}`);

  // Extrait lisible de la soumission.
  const parts = [sub.name + (sub.role ? ` — ${sub.role}` : "")];
  if (sub.subject?.trim()) parts.push(`Sujet : ${sub.subject.trim()}`);
  if (sub.bio?.trim()) parts.push(sub.bio.trim());
  if (sub.message?.trim()) parts.push(sub.message.trim());
  if (sub.link?.trim()) parts.push(`Lien : ${sub.link.trim()}`);
  const snippet = parts.join("\n");

  const existing = (comm.intervenants_text ?? "").trim();
  // Idempotent : si déjà présent, on ne duplique pas.
  if (!existing.includes(snippet)) {
    const merged = existing ? `${existing}\n\n${snippet}` : snippet;
    await supabase
      .from("communications")
      .update({ intervenants_text: merged })
      .eq("id", communicationId);
  }
  redirect(`/communications/${communicationId}`);
}

/** Génère des questions IA à poser aux intervenants selon le contexte (US-6.3). */
export async function generateQuestionsAction(formData: FormData) {
  const communicationId = String(formData.get("communication_id") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: commData } = await supabase
    .from("communications")
    .select("*")
    .eq("id", communicationId)
    .maybeSingle();
  const comm = commData as Communication | null;
  if (!comm) redirect("/");

  const { data: wsData } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", comm.workspace_id ?? "")
    .maybeSingle();
  const ws = wsData as Workspace | null;
  const charter = (await getActiveCharter(supabase, comm.workspace_id ?? ""))
    .content;
  const context = ws ? buildWorkspaceContext(ws) : "";
  const facts: EventFacts = {
    eventName: comm.name,
    eventDate: comm.event_date,
    eventLocation: comm.event_location ?? undefined,
    eventLink: comm.event_link ?? undefined,
  };

  try {
    const questions = await suggestIntervenantQuestions(
      charter,
      context,
      facts,
      comm.intervenants_text ?? "",
    );
    await supabase
      .from("communications")
      .update({ suggested_questions: questions })
      .eq("id", communicationId);
  } catch {
    redirect(`/communications/${communicationId}?qError=1`);
  }
  redirect(`/communications/${communicationId}`);
}
