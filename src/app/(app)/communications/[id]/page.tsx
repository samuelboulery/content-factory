import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { type Communication, type Post } from "@/lib/types";
import { checkCompliance } from "@/lib/compliance";
import { editCommunicationAction } from "@/lib/communication-actions";
import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default async function CommunicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ regenError?: string }>;
}) {
  const { id } = await params;
  const { regenError } = await searchParams;
  const supabase = await createClient();

  // RLS scope automatiquement aux communications du workspace de l'utilisateur.
  const { data: commData } = await supabase
    .from("communications")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const comm = (commData ?? null) as Communication | null;
  if (!comm) notFound();

  const { data: postsData } = await supabase
    .from("posts")
    .select("*")
    .eq("communication_id", id)
    .order("scheduled_date", { ascending: true });
  const posts = (postsData ?? []) as Post[];

  const eventDateLabel = format(parseISO(comm.event_date), "d MMMM yyyy", {
    locale: fr,
  });

  const total = posts.length;
  const publishedCount = posts.filter((p) => p.status === "published").length;
  const asIsCount = posts.filter(
    (p) => p.status === "published" && !p.edited,
  ).length;

  // Divergence : post publié AVANT la dernière modif des faits durs (US-5.13).
  const factsUpdatedAt = new Date(comm.facts_updated_at).getTime();
  const isDiverged = (post: Post): boolean =>
    post.status === "published" &&
    post.published_at !== null &&
    new Date(post.published_at).getTime() < factsUpdatedAt;

  return (
    <main className="mx-auto max-w-3xl p-8">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Accueil
      </Link>

      <header className="mt-4 mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{comm.name}</h1>
        <p className="text-muted-foreground">
          {eventDateLabel}
          {comm.event_location ? ` · ${comm.event_location}` : ""}
        </p>
        {total > 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {publishedCount}/{total} publiés · {asIsCount} tel quel (sans
            édition)
          </p>
        ) : null}
      </header>

      <details className="mb-6 rounded-lg border p-4">
        <summary className="cursor-pointer text-sm font-medium">
          Éditer la fiche (faits durs)
        </summary>
        <form action={editCommunicationAction} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="communication_id" value={comm.id} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nom de l&apos;événement *</Label>
            <Input id="name" name="name" required defaultValue={comm.name} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="event_date">Date *</Label>
            <Input
              id="event_date"
              name="event_date"
              type="date"
              required
              defaultValue={comm.event_date}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="event_location">Lieu</Label>
            <Input
              id="event_location"
              name="event_location"
              defaultValue={comm.event_location ?? ""}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="event_link">Lien d&apos;inscription</Label>
            <Input
              id="event_link"
              name="event_link"
              type="url"
              defaultValue={comm.event_link ?? ""}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="intervenants_text">Intervenants</Label>
            <Textarea
              id="intervenants_text"
              name="intervenants_text"
              rows={4}
              defaultValue={comm.intervenants_text ?? ""}
            />
          </div>
          <Button type="submit" className="self-start">
            Enregistrer la fiche
          </Button>
          <p className="text-xs text-muted-foreground">
            Modifier un fait dur flague les posts déjà publiés (à vérifier). La
            régénération les remettra à jour.
          </p>
        </form>
      </details>

      {regenError ? (
        <p className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          La régénération a échoué (erreur LLM). Le post n&apos;a pas été
          modifié. Réessaie.
        </p>
      ) : null}

      <div className="flex flex-col gap-4">
        {posts.length === 0 ? (
          <p className="text-muted-foreground">
            Aucun post pour cette communication.
          </p>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              postId={post.id}
              content={post.content}
              dateLabel={format(parseISO(post.scheduled_date), "d MMMM yyyy", {
                locale: fr,
              })}
              soWhat={post.so_what}
              compliance={checkCompliance(post.content)}
              status={post.status}
              edited={post.edited}
              diverged={isDiverged(post)}
            />
          ))
        )}
      </div>
    </main>
  );
}
