import { NextResponse } from "next/server";
import { addDays, format, isValid, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { buildWorkspaceContext, resolveActiveWorkspace } from "@/lib/workspace";
import { getActiveCharter } from "@/lib/charter-versions";
import { generatePosts, type EventFacts } from "@/lib/llm";

// La génération DeepSeek (4 posts) peut être longue : on relève la limite.
export const maxDuration = 60;

type GenerateBody = {
  name?: unknown;
  event_date?: unknown;
  event_location?: unknown;
  event_link?: unknown;
  intervenants_text?: unknown;
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

  // 1) Workspace actif (créé si absent) + charte active + contexte du workspace
  let workspaceId: string;
  let charter: string;
  let context: string;
  try {
    const { active } = await resolveActiveWorkspace(supabase, user.id);
    workspaceId = active.id;
    charter = (await getActiveCharter(supabase, active.id)).content;
    context = buildWorkspaceContext(active);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Workspace introuvable.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // 2) Génération IA (avec la charte + le contexte du workspace)
  let posts;
  try {
    posts = await generatePosts(facts, intervenants, charter, context);
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

  // 4) Calcul des dates réelles + insertion des 4 posts
  const eventDateObj = parseISO(eventDate);
  const rows = posts.map((post) => ({
    communication_id: comm.id as string,
    scheduled_date: format(
      addDays(eventDateObj, post.scheduled_offset_days),
      "yyyy-MM-dd",
    ),
    content: post.content,
    so_what: post.so_what || null,
  }));

  const { error: postsError } = await supabase.from("posts").insert(rows);
  if (postsError) {
    // Rollback : pas de communication orpheline si l'insertion des posts échoue.
    await supabase.from("communications").delete().eq("id", comm.id as string);
    return NextResponse.json(
      { error: `Erreur base de données (posts) : ${postsError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: comm.id as string });
}
