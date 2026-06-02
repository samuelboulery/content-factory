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
import { getWorkspaceRole } from "@/lib/members";
import { type EventStep } from "@/lib/types";

// Génération multi-plateformes en parallèle : on relève la limite (cap Vercel Hobby = 60s).
export const maxDuration = 60;

type GenerateBody = {
  name?: unknown;
  event_date?: unknown;
  event_location?: unknown;
  event_link?: unknown;
  intervenants_text?: unknown;
  networks?: unknown;
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
  const eventDate = typeof body.event_date === "string" ? body.event_date : "";
  const eventLocation = asTrimmedString(body.event_location);
  const eventLink = asTrimmedString(body.event_link);
  const intervenants = asTrimmedString(body.intervenants_text);

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

  // 1) Prépa : workspace + rôle + charte de base + contexte + étapes + plateformes ciblées.
  let workspaceId: string;
  let baseCharter: string;
  let context: string;
  let steps: EventStep[];
  let selectedNetworks: string[];
  let charterByNetwork: Map<string, string>;
  try {
    const { active } = await resolveActiveWorkspace(supabase, user.id);
    if (!active) {
      return NextResponse.json(
        { error: "Aucun workspace actif. Crée un workspace d'abord." },
        { status: 400 },
      );
    }
    workspaceId = active.id;
    // Garde de rôle AVANT tout appel LLM coûteux : seuls owner/editor génèrent.
    const role = await getWorkspaceRole(supabase, active.id, user.id);
    if (role !== "owner" && role !== "editor") {
      return NextResponse.json(
        { error: "Accès refusé : rôle insuffisant pour générer." },
        { status: 403 },
      );
    }

    // Plateformes ciblées : intersection avec les réseaux du workspace ; défaut = toutes.
    const wsNetworks =
      active.networks.length > 0 ? active.networks : ["LinkedIn"];
    const requestedNetworks = Array.isArray(body.networks)
      ? body.networks.filter((n): n is string => typeof n === "string")
      : [];
    selectedNetworks = requestedNetworks.filter((n) => wsNetworks.includes(n));
    if (selectedNetworks.length === 0) selectedNetworks = wsNetworks;

    baseCharter = (await getActiveCharter(supabase, active.id)).content;
    // Charte fusionnée (base + overlay) par plateforme, pré-calculée.
    charterByNetwork = new Map(
      selectedNetworks.map((net) => [
        net,
        mergeNetworkCharter(baseCharter, getNetworkCharter(active, net), net),
      ]),
    );
    context = buildWorkspaceContext(active);

    const templates = await listTemplates(supabase, active.id);
    const requestedTemplate = asTrimmedString(body.template_id);
    const template =
      templates.find((t) => t.id === requestedTemplate) ?? templates[0];
    steps = template
      ? await getTemplateSteps(supabase, template.id)
      : DEFAULT_EVENT_STEPS;
  } catch (err) {
    console.error("[generate] préparation workspace/charte:", err);
    return NextResponse.json(
      { error: "Préparation impossible. Réessaie." },
      { status: 500 },
    );
  }

  // 2) Génération IA EN PARALLÈLE sur chaque plateforme (best-effort par plateforme).
  const genResults = await Promise.allSettled(
    selectedNetworks.map(async (net) => {
      const posts = await generatePosts(
        facts,
        intervenants,
        charterByNetwork.get(net) ?? baseCharter,
        context,
        steps,
        net,
      );
      return { network: net, posts };
    }),
  );
  const ok = genResults.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  const failedNetworks = selectedNetworks.filter(
    (_, i) => genResults[i].status === "rejected",
  );
  if (failedNetworks.length > 0) {
    console.error("[generate] plateformes en échec:", failedNetworks);
  }
  if (ok.length === 0) {
    return NextResponse.json(
      { error: "La génération IA a échoué. Réessaie." },
      { status: 502 },
    );
  }
  const generatedNetworks = ok.map((g) => g.network);

  // 3) Insertion de la communication (plateformes réellement générées).
  const { data: comm, error: commError } = await supabase
    .from("communications")
    .insert({
      name,
      event_date: eventDate,
      event_location: eventLocation || null,
      event_link: eventLink || null,
      intervenants_text: intervenants || null,
      workspace_id: workspaceId,
      networks: generatedNetworks,
      network: generatedNetworks[0],
    })
    .select("id")
    .single();
  if (commError || !comm) {
    console.error("[generate] insert communication:", commError);
    return NextResponse.json(
      { error: "Enregistrement de la communication impossible." },
      { status: 500 },
    );
  }

  // 4) Dates + anti-collision PAR plateforme (mêmes jours entre plateformes,
  //    décalés au sein d'une même plateforme entre campagnes).
  const eventDateObj = parseISO(eventDate);
  const occupiedByNet = new Map<string, Set<string>>();
  const { data: wsCommIds } = await supabase
    .from("communications")
    .select("id")
    .eq("workspace_id", workspaceId);
  const allCommIds = (wsCommIds ?? []).map((c) => c.id as string);
  if (allCommIds.length > 0) {
    const { data: existingPosts } = await supabase
      .from("posts")
      .select("network, scheduled_date")
      .in("communication_id", allCommIds);
    for (const p of existingPosts ?? []) {
      const net = p.network as string;
      if (!occupiedByNet.has(net)) occupiedByNet.set(net, new Set());
      occupiedByNet.get(net)!.add(p.scheduled_date as string);
    }
  }
  const occ = (net: string): Set<string> => {
    let set = occupiedByNet.get(net);
    if (!set) {
      set = new Set();
      occupiedByNet.set(net, set);
    }
    return set;
  };

  const rows = ok.flatMap((g) => {
    const occSet = occ(g.network);
    const ordered = [...g.posts].sort(
      (a, b) => a.scheduled_offset_days - b.scheduled_offset_days,
    );
    return ordered.map((post) => {
      const base = addDays(eventDateObj, post.scheduled_offset_days);
      const scheduled_date = findFreeDate(base, occSet);
      if (occSet.has(scheduled_date)) {
        console.warn(
          `[generate] collision de date tolérée (${g.network}): ${scheduled_date}`,
        );
      }
      occSet.add(scheduled_date);
      return {
        communication_id: comm.id as string,
        scheduled_date,
        content: post.content,
        so_what: post.so_what || null,
        original_content: post.content,
        network: g.network,
      };
    });
  });

  const { data: inserted, error: postsError } = await supabase
    .from("posts")
    .insert(rows)
    .select("id, content, network");
  if (postsError || !inserted) {
    console.error("[generate] insert posts:", postsError);
    const { error: rollbackError } = await supabase
      .from("communications")
      .delete()
      .eq("id", comm.id as string);
    if (rollbackError) {
      console.error("[generate] rollback communication échoué:", rollbackError);
    }
    return NextResponse.json(
      { error: "Enregistrement des posts impossible. Réessaie." },
      { status: 500 },
    );
  }

  // 5) Relecture IA best-effort APRÈS insertion, par plateforme (en parallèle).
  const insertedPosts = inserted as {
    id: string;
    content: string;
    network: string;
  }[];
  const byNet = new Map<string, typeof insertedPosts>();
  for (const p of insertedPosts) {
    if (!byNet.has(p.network)) byNet.set(p.network, []);
    byNet.get(p.network)!.push(p);
  }
  await Promise.all(
    [...byNet.entries()].map(async ([net, ps]) => {
      try {
        const reviews = await reviewCampaign(
          charterByNetwork.get(net) ?? baseCharter,
          facts,
          ps.map((p) => p.content),
        );
        const results = await Promise.all(
          ps.map((p, i) =>
            supabase
              .from("posts")
              .update({ ai_review: reviews[i] ?? null })
              .eq("id", p.id),
          ),
        );
        for (const r of results) {
          if (r.error) console.error("[generate] update ai_review:", r.error);
        }
      } catch (err) {
        console.error(`[generate] relecture IA ${net} (best-effort):`, err);
      }
    }),
  );

  return NextResponse.json({ id: comm.id as string });
}
