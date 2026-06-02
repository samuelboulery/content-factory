"use server";

import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveCharter } from "@/lib/charter-versions";
import { buildWorkspaceContext } from "@/lib/workspace";
import { getNetworkCharter, mergeNetworkCharter } from "@/lib/network-charter";
import {
  regeneratePost,
  reviewSinglePost,
  type CampaignPost,
  type EventFacts,
} from "@/lib/llm";
import type {
  Communication,
  Post,
  PostReview,
  PostRevision,
  Workspace,
} from "@/lib/types";

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

  const baseCharter = (
    await getActiveCharter(supabase, comm.workspace_id ?? "")
  ).content;

  const { data: wsData } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", comm.workspace_id ?? "")
    .maybeSingle();
  const ws = wsData as Workspace | null;
  const context = ws ? buildWorkspaceContext(ws) : "";
  // Régénération = même réseau que la com → applique l'overlay de charte (US-2.5).
  const charter = ws
    ? mergeNetworkCharter(
        baseCharter,
        getNetworkCharter(ws, comm.network),
        comm.network,
      )
    : baseCharter;

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
    // Relecture IA best-effort du post régénéré (US-5.5) : un échec ne bloque pas.
    let ai_review: PostReview | null;
    try {
      ai_review = await reviewSinglePost(charter, facts, content);
    } catch {
      ai_review = null;
    }
    // Snapshot de l'état courant AVANT écrasement, borné à 3, plus récent en tête (US-5.10).
    const snapshot: PostRevision = {
      content: target.content,
      so_what: target.so_what,
      regenerated_at: new Date().toISOString(),
      note: note || null,
    };
    const history = [snapshot, ...(target.previous_versions ?? [])].slice(0, 3);
    await supabase
      .from("posts")
      // Régénération = nouveau brouillon IA : repasse "à publier", flags remis à zéro.
      .update({
        content,
        so_what: so_what || null,
        edited: false,
        status: "to_publish",
        published_at: null,
        previous_versions: history,
        ai_review,
        original_content: content, // nouveau brouillon IA figé (boucle d'apprentissage)
      })
      .eq("id", target.id);
  } catch {
    redirect(`/communications/${target.communication_id}?regenError=1`);
  }

  redirect(`/communications/${target.communication_id}`);
}

/** Restaure une régénération précédente sans appel LLM (US-5.10). */
export async function rollbackPostAction(formData: FormData) {
  const postId = String(formData.get("post_id") ?? "");
  const index = Number(formData.get("version_index") ?? "");

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

  const version = (target.previous_versions ?? [])[index];
  if (!version) redirect(`/communications/${target.communication_id}`);

  // Restaurer un ancien brouillon IA = repasse "à publier", flags remis à zéro (pas de re-snapshot).
  await supabase
    .from("posts")
    .update({
      content: version.content,
      so_what: version.so_what,
      edited: false,
      status: "to_publish",
      published_at: null,
    })
    .eq("id", target.id);
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

/** Change manuellement la date planifiée d'un post (US-5.4, override). */
export async function updatePostDateAction(formData: FormData) {
  const postId = String(formData.get("post_id") ?? "");
  const scheduledDate = String(formData.get("scheduled_date") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: postData } = await supabase
    .from("posts")
    .select("communication_id")
    .eq("id", postId)
    .maybeSingle();
  const post = postData as { communication_id: string } | null;
  if (!post) redirect("/");

  // Date valide (yyyy-MM-dd) requise ; sinon on ignore (pas de corruption).
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
    redirect(`/communications/${post.communication_id}`);
  }

  await supabase
    .from("posts")
    .update({ scheduled_date: scheduledDate })
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
