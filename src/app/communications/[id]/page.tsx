import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase, type Communication, type Post } from "@/lib/supabase";
import { checkCompliance } from "@/lib/compliance";
import { PostCard } from "@/components/PostCard";

export default async function CommunicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: commData } = await supabase
    .from("communications")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  // Le client Supabase n'est pas typé via génériques DB → cast explicite assumé.
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

      <div className="flex flex-col gap-4">
        {posts.length === 0 ? (
          <p className="text-muted-foreground">
            Aucun post pour cette communication.
          </p>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
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
