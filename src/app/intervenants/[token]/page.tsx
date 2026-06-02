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
      ? (data[0] as { name: string; event_date: string })
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
      <p className="text-muted-foreground">{dateLabel}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Tu interviens à cet événement ? Partage ta matière — on s&apos;en sert
        pour préparer la communication.
      </p>

      {sent ? (
        <div className="mt-6 rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          Merci, c&apos;est bien envoyé ✓
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
            <Label htmlFor="role">Ton rôle / sujet</Label>
            <Input
              id="role"
              name="role"
              placeholder="Ex : UX researcher, talk sur les design tokens"
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
              placeholder="Le sujet, l'angle, ce qui compte pour toi…"
            />
          </div>
          <SubmitButton pendingLabel="Envoi…">Envoyer</SubmitButton>
        </form>
      )}
    </main>
  );
}
