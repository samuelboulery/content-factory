import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { type Communication, type Post } from "@/lib/types";
import { checkCompliance } from "@/lib/compliance";
import { PostCard } from "@/components/PostCard";

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
      </header>

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
            />
          ))
        )}
      </div>
    </main>
  );
}
