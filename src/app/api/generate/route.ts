import { NextResponse } from "next/server";
import { addDays, isValid, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { buildWorkspaceContext, resolveActiveWorkspace } from "@/lib/workspace";
import { getActiveCharter } from "@/lib/charter-versions";
import { DEFAULT_EVENT_STEPS, getTemplateSteps } from "@/lib/template-steps";
import { listTemplates } from "@/lib/templates";
import { generatePosts, reviewCampaign, type EventFacts } from "@/lib/llm";
import { findFreeDate } from "@/lib/schedule";
import { getNetworkCharter, mergeNetworkCharter } from "@/lib/network-charter";
import { type EventStep } from "@/lib/types";

// La génération DeepSeek (4 posts) peut être longue : on relève la limite.
export const maxDuration = 60;

type GenerateBody = {
  name?: unknown;
  event_date?: unknown;
  event_location?: unknown;
  event_link?: unknown;
  intervenants_text?: unknown;
  network?: unknown;
  template_id?: unknown;
};

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  let body: GenerateBody;
  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête JSON invalide." },
      { status: 400 },
    );
  }

  const name = asTrimmedString(body.name);
  const eventDate =
    typeof body.event_date === "string" ? body.event_date : "";
  const eventLocation = asTrimmedString(body.event_location);
  const eventLink = asTrimmedString(body.event_link);
  const intervenants = asTrimmedString(body.intervenants_text);

  // Validation des faits durs requis (fail fast).
  if (!name) {
    return NextResponse.json(
      { error: "Le nom de l'événement est requis." },
      { status: 400 },
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || !isValid(parseISO(eventDate))) {
    return NextResponse.json(
      { error: "La date de l'événement est invalide (format AAAA-MM-JJ attendu)." },
      { status: 400 },
    );
  }

  const facts: EventFacts = {
    eventName: name,
    eventDate,
    eventLocation: eventLocation || undefined,
    eventLink: eventLink || undefined,
  };

  // 1) Workspace actif (créé si absent) + charte active (+ overlay réseau) + contexte
  let workspaceId: string;
  let charter: string;
  let context: string;
  let steps: EventStep[];
  let network: string;
  try {
    const { active } = await resolveActiveWorkspace(supabase, user.id);
    if (!active) {
      return NextResponse.json(
        { error: "Aucun workspace actif. Crée un workspace d'abord." },
        { status: 400 },
      );
    }
    workspaceId = active.id;
    // Réseau cible : la valeur demandée si elle fait partie des réseaux du workspace, sinon le premier.
    const networks = active.networks.length > 0 ? active.networks : ["LinkedIn"];
    const requested = asTrimmedString(body.network);
    network = networks.includes(requested) ? requested : networks[0];
    const baseCharter = (await getActiveCharter(supabase, active.id)).content;
    charter = mergeNetworkCharter(
      baseCharter,
      getNetworkCharter(active, network),
      network,
    );
    context = buildWorkspaceContext(active);
    // Template choisi (validé contre ceux du workspace), sinon le premier. US-3.4.
    const templates = await listTemplates(supabase, active.id);
    const requestedTemplate = asTrimmedString(body.template_id);
    const template =
      templates.find((t) => t.id === requestedTemplate) ?? templates[0];
    steps = template
      ? await getTemplateSteps(supabase, template.id)
      : DEFAULT_EVENT_STEPS;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Workspace introuvable.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // 2) Génération IA (charte + overlay réseau + contexte + rétroplanning du workspace)
  let posts;
  try {
    posts = await generatePosts(facts, intervenants, charter, context, steps, network);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Échec de la génération IA.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // 3) Insertion de la communication (scopée workspace)
  const { data: comm, error: commError } = await supabase
    .from("communications")
    .insert({
      name,
      event_date: eventDate,
      event_location: eventLocation || null,
      event_link: eventLink || null,
      intervenants_text: intervenants || null,
      workspace_id: workspaceId,
      network,
    })
    .select("id")
    .single();

  if (commError || !comm) {
    return NextResponse.json(
      {
        error: `Erreur base de données (communication) : ${commError?.message ?? "inconnue"}`,
      },
      { status: 500 },
    );
  }

  // 4) Calcul des dates réelles + anti-chevauchement (US-5.4) + insertion
  const eventDateObj = parseISO(eventDate);

  // Jours déjà occupés par d'autres posts du même workspace.
  const occupied = new Set<string>();
  const { data: wsCommIds } = await supabase
    .from("communications")
    .select("id")
    .eq("workspace_id", workspaceId);
  const commIds = (wsCommIds ?? []).map((c) => c.id as string);
  if (commIds.length > 0) {
    const { data: existingPosts } = await supabase
      .from("posts")
      .select("scheduled_date")
      .in("communication_id", commIds);
    for (const p of existingPosts ?? []) {
      occupied.add(p.scheduled_date as string);
    }
  }

  // Assigne du plus tôt au plus tard : chaque post prend le jour libre le plus
  // proche de sa date théorique, puis réserve ce jour pour les suivants.
  const ordered = [...posts].sort(
    (a, b) => a.scheduled_offset_days - b.scheduled_offset_days,
  );
  const rows = ordered.map((post) => {
    const base = addDays(eventDateObj, post.scheduled_offset_days);
    const scheduled_date = findFreeDate(base, occupied);
    occupied.add(scheduled_date);
    return {
      communication_id: comm.id as string,
      scheduled_date,
      content: post.content,
      so_what: post.so_what || null,
      original_content: post.content, // brouillon IA figé (boucle d'apprentissage)
    };
  });

  const { data: inserted, error: postsError } = await supabase
    .from("posts")
    .insert(rows)
    .select("id, content");
  if (postsError || !inserted) {
    // Rollback : éviter une communication orpheline si l'insertion des posts échoue.
    const { error: rollbackError } = await supabase
      .from("communications")
      .delete()
      .eq("id", comm.id as string);
    const suffix = rollbackError
      ? " (rollback de la communication échoué — ligne à nettoyer manuellement)"
      : "";
    return NextResponse.json(
      { error: `Erreur base de données (posts) : ${postsError?.message ?? "inconnue"}${suffix}` },
      { status: 500 },
    );
  }

  // 5) Relecture IA best-effort (US-5.5) APRÈS insertion : un échec/timeout ne
  // fait jamais perdre les posts. On enrichit ai_review par id (ordre-indépendant).
  const insertedPosts = inserted as { id: string; content: string }[];
  try {
    const reviews = await reviewCampaign(
      charter,
      facts,
      insertedPosts.map((p) => p.content),
    );
    await Promise.all(
      insertedPosts.map((p, i) =>
        supabase
          .from("posts")
          .update({ ai_review: reviews[i] ?? null })
          .eq("id", p.id),
      ),
    );
  } catch {
    // Relecture indisponible : les posts restent valides avec ai_review = null.
  }

  return NextResponse.json({ id: comm.id as string });
}
