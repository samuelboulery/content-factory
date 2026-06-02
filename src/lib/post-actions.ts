"use server";

import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveCharter } from "@/lib/charter-versions";
import { buildWorkspaceContext } from "@/lib/workspace";
import {
  regeneratePost,
  type CampaignPost,
  type EventFacts,
} from "@/lib/llm";
import type { Communication, Post, Workspace } from "@/lib/types";

/** Régénère un post avec une note, toute la campagne en contexte (US-5.2). */
export async function regeneratePostAction(formData: FormData) {
  const postId = String(formData.get("post_id") ?? "");
  const note = String(formData.get("note") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: postData } = await supabase
    .from("posts")
    .select("*")
    .eq("id", postId)
    .maybeSingle();
  const target = postData as Post | null;
  if (!target) redirect("/");

  const { data: commData } = await supabase
    .from("communications")
    .select("*")
    .eq("id", target.communication_id)
    .maybeSingle();
  const comm = commData as Communication | null;
  if (!comm) redirect("/");

  const { data: siblingsData } = await supabase
    .from("posts")
    .select("*")
    .eq("communication_id", target.communication_id)
    .order("scheduled_date", { ascending: true });
  const siblings = (siblingsData ?? []) as Post[];

  const charter = (await getActiveCharter(supabase, comm.workspace_id ?? ""))
    .content;

  const { data: wsData } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", comm.workspace_id ?? "")
    .maybeSingle();
  const ws = wsData as Workspace | null;
  const context = ws ? buildWorkspaceContext(ws) : "";

  const campaign: CampaignPost[] = siblings.map((post) => ({
    dateLabel: format(parseISO(post.scheduled_date), "d MMMM yyyy", {
      locale: fr,
    }),
    content: post.content,
    status: post.status === "published" ? "publié" : "à publier",
    isTarget: post.id === target.id,
  }));

  const facts: EventFacts = {
    eventName: comm.name,
    eventDate: comm.event_date,
    eventLocation: comm.event_location ?? undefined,
    eventLink: comm.event_link ?? undefined,
  };

  try {
    const { content, so_what } = await regeneratePost({
      charter,
      context,
      facts,
      campaign,
      note,
    });
    await supabase
      .from("posts")
      // Régénération = nouveau brouillon IA : repasse "à publier", flags remis à zéro.
      .update({
        content,
        so_what: so_what || null,
        edited: false,
        status: "to_publish",
        published_at: null,
      })
      .eq("id", target.id);
  } catch {
    redirect(`/communications/${target.communication_id}?regenError=1`);
  }

  redirect(`/communications/${target.communication_id}`);
}

/** Édition manuelle du contenu d'un post (US-5.3). */
export async function editPostAction(formData: FormData) {
  const postId = String(formData.get("post_id") ?? "");
  const content = String(formData.get("content") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!content) redirect("/");

  const { data: postData } = await supabase
    .from("posts")
    .select("communication_id")
    .eq("id", postId)
    .maybeSingle();
  const post = postData as { communication_id: string } | null;
  if (!post) redirect("/");

  // Édition manuelle → marque le post comme édité (détection auto, US-5.9).
  await supabase
    .from("posts")
    .update({ content, edited: true })
    .eq("id", postId);
  redirect(`/communications/${post.communication_id}`);
}

/** Publie / dé-publie un post (US-8.2). Le « édité » est détecté automatiquement. */
export async function updatePostStateAction(formData: FormData) {
  const postId = String(formData.get("post_id") ?? "");
  const state = String(formData.get("state") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let update: { status: string; published_at: string | null };
  switch (state) {
    case "publish":
      update = { status: "published", published_at: new Date().toISOString() };
      break;
    case "unpublish":
      update = { status: "to_publish", published_at: null };
      break;
    default:
      redirect("/");
  }

  const { data: postData } = await supabase
    .from("posts")
    .select("communication_id")
    .eq("id", postId)
    .maybeSingle();
  const post = postData as { communication_id: string } | null;
  if (!post) redirect("/");

  await supabase.from("posts").update(update).eq("id", postId);
  redirect(`/communications/${post.communication_id}`);
}
