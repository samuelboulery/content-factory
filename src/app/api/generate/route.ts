import { NextResponse } from "next/server";
import { addDays, format, isValid, parseISO } from "date-fns";
import { supabase } from "@/lib/supabase";
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

  // 1) Génération IA
  let posts;
  try {
    posts = await generatePosts(facts, intervenants);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Échec de la génération IA.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // 2) Insertion de la communication
  const { data: comm, error: commError } = await supabase
    .from("communications")
    .insert({
      name,
      event_date: eventDate,
      event_location: eventLocation || null,
      event_link: eventLink || null,
      intervenants_text: intervenants || null,
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

  // 3) Calcul des dates réelles + insertion des 4 posts
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
