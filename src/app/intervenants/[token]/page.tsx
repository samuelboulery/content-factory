import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { submitIntervenantAction } from "@/lib/intervenant-actions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/SubmitButton";

export default async function IntervenantFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { token } = await params;
  const { sent, error } = await searchParams;
  const supabase = await createClient();

  // Fonction security-definer : seules name + event_date sont exposées.
  const { data } = await supabase.rpc("get_communication_public", {
    p_token: token,
  });
  const comm =
    Array.isArray(data) && data.length > 0
      ? (data[0] as {
          name: string;
          event_date: string;
          event_location?: string | null;
          suggested_questions?: string[] | null;
        })
      : null;

  if (!comm) {
    return (
      <main className="mx-auto max-w-md p-8">
        <p className="text-sm text-muted-foreground">
          Lien invalide ou expiré.
        </p>
      </main>
    );
  }

  const dateLabel = format(parseISO(comm.event_date), "d MMMM yyyy", {
    locale: fr,
  });

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-semibold tracking-tight">{comm.name}</h1>
      <p className="text-muted-foreground">
        {dateLabel}
        {comm.event_location ? ` · 📍 ${comm.event_location}` : ""}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Tu interviens à cet événement ? Partage ta matière — on s&apos;en sert
        pour préparer la communication.
      </p>

      {comm.suggested_questions && comm.suggested_questions.length > 0 ? (
        <div className="mt-4 rounded-md border bg-muted/40 p-3 text-sm">
          <p className="font-medium">Ce qui nous intéresse :</p>
          <ul className="mt-1 list-inside list-disc text-muted-foreground">
            {comm.suggested_questions.map((question, idx) => (
              <li key={`${question}-${idx}`}>{question}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {sent ? (
        <div className="mt-6 rounded-md border border-green-300 bg-green-50 p-4 text-sm text-green-800">
          <p>Merci, c&apos;est bien envoyé ✓</p>
          <a
            href={`/intervenants/${token}`}
            className="mt-2 inline-block font-medium underline"
          >
            Envoyer une autre réponse
          </a>
        </div>
      ) : (
        <form
          action={submitIntervenantAction}
          className="mt-6 flex flex-col gap-4"
        >
          <input type="hidden" name="token" value={token} />
          {error ? (
            <p className="text-sm text-red-600">
              L&apos;envoi a échoué. Réessaie.
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Ton nom *</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="role">Ton rôle</Label>
            <Input
              id="role"
              name="role"
              placeholder="Ex : UX researcher, designer produit…"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="subject">Sujet d&apos;intervention</Label>
            <Input
              id="subject"
              name="subject"
              placeholder="Ex : Design tokens à l'échelle"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bio">Quelques mots sur toi</Label>
            <Textarea id="bio" name="bio" rows={3} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="message">Ce que tu veux partager</Label>
            <Textarea
              id="message"
              name="message"
              rows={4}
              placeholder="L'angle, ce qui compte pour toi…"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="link">Lien (LinkedIn / site)</Label>
            <Input
              id="link"
              name="link"
              type="url"
              placeholder="https://linkedin.com/in/…"
            />
          </div>
          <SubmitButton pendingLabel="Envoi…">Envoyer</SubmitButton>
        </form>
      )}
    </main>
  );
}
