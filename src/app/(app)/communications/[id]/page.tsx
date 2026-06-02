import Link from "next/link";
import { notFound } from "next/navigation";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/session";
import {
  type Communication,
  type IntervenantSubmission,
  type Post,
} from "@/lib/types";
import { checkCompliance } from "@/lib/compliance";
import { editCommunicationAction } from "@/lib/communication-actions";
import {
  addSubmissionToMatterAction,
  generateQuestionsAction,
} from "@/lib/intervenant-actions";
import { PostCard } from "@/components/PostCard";
import { SubmitButton } from "@/components/SubmitButton";
import {
  CommunicationTimeline,
  type TimelineItem,
} from "@/components/CommunicationTimeline";
import { CopyButton } from "@/components/CopyButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default async function CommunicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    regenError?: string;
    qError?: string;
    error?: string;
  }>;
}) {
  const { id } = await params;
  const { regenError, qError, error } = await searchParams;
  // Client direct + contexte de session lancé en parallèle (mémoïsé : déjà en vol
  // depuis le layout). Les lectures ci-dessous ne dépendent que de `id` (pas du
  // contexte membres) → on ne bloque pas dessus avant de les lancer.
  const supabase = await createClient();
  const ctxPromise = getSessionContext();

  // Les 3 lectures ne dépendent que de `id` → en parallèle (RLS scope au workspace).
  const [{ data: commData }, { data: postsData }, { data: subData }] =
    await Promise.all([
      supabase.from("communications").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("posts")
        .select("*")
        .eq("communication_id", id)
        .order("scheduled_date", { ascending: true }),
      supabase
        .from("intervenant_submissions")
        .select("*")
        .eq("communication_id", id)
        .order("created_at", { ascending: true }),
    ]);

  const comm = (commData ?? null) as Communication | null;
  if (!comm) notFound();

  // Rôle dans le workspace de la com → gating des écritures (US-1.5).
  const { roleByWs } = await ctxPromise;
  const role = comm.workspace_id
    ? (roleByWs.get(comm.workspace_id) ?? null)
    : null;
  const canWrite = role === "owner" || role === "editor";

  const posts = (postsData ?? []) as Post[];
  const submissions = (subData ?? []) as IntervenantSubmission[];

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

  // Timeline du rétroplanning : offset de chaque post relatif à l'événement (US-7.3).
  const offsetLabel = (scheduled: string): string => {
    const d = differenceInCalendarDays(parseISO(scheduled), parseISO(comm.event_date));
    if (d === 0) return "Jour J";
    return d < 0 ? `J${d}` : `J+${d}`;
  };
  // Timeline = un point par date (les plateformes partagent les offsets → dédup).
  const seenDates = new Set<string>();
  const timelineItems: TimelineItem[] = posts
    .filter((post) => {
      if (seenDates.has(post.scheduled_date)) return false;
      seenDates.add(post.scheduled_date);
      return true;
    })
    .map((post) => ({
      id: post.id,
      offsetLabel: offsetLabel(post.scheduled_date),
      dateLabel: format(parseISO(post.scheduled_date), "d MMMM yyyy", {
        locale: fr,
      }),
      status: post.status,
      title: post.so_what ?? post.content.slice(0, 90),
    }));

  // Posts groupés par plateforme (multi-plateforme).
  const postsByNetwork = new Map<string, Post[]>();
  for (const post of posts) {
    if (!postsByNetwork.has(post.network)) postsByNetwork.set(post.network, []);
    postsByNetwork.get(post.network)!.push(post);
  }

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
          {` · ${comm.networks.length > 0 ? comm.networks.join(" · ") : comm.network}`}
        </p>
        {total > 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {publishedCount}/{total} publiés · {asIsCount} tel quel (sans
            édition)
          </p>
        ) : null}
      </header>

      <section className="mb-6 rounded-lg border p-4">
        <h2 className="text-sm font-medium">
          Lien à partager avec les intervenants
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Ils déposent leur matière sans compte ; elle apparaît ci-dessous.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <code className="truncate rounded bg-muted px-2 py-1 text-xs">
            /intervenants/{comm.share_token}
          </code>
          <CopyButton value={`/intervenants/${comm.share_token}`}>
            Copier le lien
          </CopyButton>
        </div>
      </section>

      <section className="mb-6 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-medium">
            Questions à poser aux intervenants (IA)
          </h2>
          {canWrite ? (
            <form action={generateQuestionsAction}>
              <input type="hidden" name="communication_id" value={comm.id} />
              <SubmitButton pendingLabel="Génération…">
                {comm.suggested_questions.length > 0 ? "Régénérer" : "Générer"}
              </SubmitButton>
            </form>
          ) : null}
        </div>
        {qError ? (
          <p className="mt-2 text-xs text-red-600">
            Génération des questions échouée. Réessaie.
          </p>
        ) : null}
        {comm.suggested_questions.length > 0 ? (
          <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
            {comm.suggested_questions.map((question, idx) => (
              <li key={`${question}-${idx}`}>{question}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Génère des questions adaptées à l&apos;événement pour guider les
            intervenants.
          </p>
        )}
      </section>

      {canWrite ? (
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
      ) : null}

      {submissions.length > 0 ? (
        <section className="mb-6">
          <h2 className="text-lg font-medium">
            Matière reçue ({submissions.length})
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {submissions.map((submission) => (
              <li key={submission.id} className="rounded-lg border p-3 text-sm">
                <div className="font-medium">
                  {submission.name}
                  {submission.role ? ` · ${submission.role}` : ""}
                </div>
                {submission.subject ? (
                  <p className="text-muted-foreground">
                    Sujet : {submission.subject}
                  </p>
                ) : null}
                {submission.bio ? (
                  <p className="text-muted-foreground">{submission.bio}</p>
                ) : null}
                {submission.message ? (
                  <p className="mt-1 whitespace-pre-wrap">
                    {submission.message}
                  </p>
                ) : null}
                {submission.link ? (
                  <a
                    href={submission.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs text-blue-600 underline"
                  >
                    {submission.link}
                  </a>
                ) : null}
                {canWrite ? (
                  <form action={addSubmissionToMatterAction} className="mt-2">
                    <input
                      type="hidden"
                      name="communication_id"
                      value={comm.id}
                    />
                    <input
                      type="hidden"
                      name="submission_id"
                      value={submission.id}
                    />
                    <SubmitButton pendingLabel="Ajout…">
                      Ajouter à la matière
                    </SubmitButton>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {regenError ? (
        <p className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          La régénération a échoué (erreur LLM). Le post n&apos;a pas été
          modifié. Réessaie.
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          L&apos;action a échoué — rien n&apos;a été modifié. Réessaie.
        </p>
      ) : null}

      {timelineItems.length > 0 ? (
        <section className="mb-6 rounded-lg border p-4">
          <h2 className="mb-4 text-sm font-medium">Rétroplanning</h2>
          <CommunicationTimeline
            items={timelineItems}
            eventDateLabel={eventDateLabel}
          />
        </section>
      ) : null}

      {posts.length === 0 ? (
        <p className="text-muted-foreground">
          Aucun post pour cette communication.
        </p>
      ) : (
        [...postsByNetwork.entries()].map(([network, networkPosts]) => (
          <section key={network} className="mb-6">
            <h2 className="mb-3 text-lg font-medium">{network}</h2>
            <div className="flex flex-col gap-4">
              {networkPosts.map((post) => (
                <PostCard
                  key={post.id}
                  postId={post.id}
                  content={post.content}
                  dateLabel={format(parseISO(post.scheduled_date), "d MMMM yyyy", {
                    locale: fr,
                  })}
                  scheduledDate={post.scheduled_date}
                  soWhat={post.so_what}
                  compliance={checkCompliance(post.content)}
                  status={post.status}
                  edited={post.edited}
                  diverged={isDiverged(post)}
                  previousVersions={post.previous_versions ?? []}
                  aiReview={post.ai_review ?? null}
                  canWrite={canWrite}
                  network={post.network}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}
