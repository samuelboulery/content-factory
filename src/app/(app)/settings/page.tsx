import Link from "next/link";
import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveWorkspace } from "@/lib/workspace";
import {
  getActiveCharter,
  listCharterVersions,
} from "@/lib/charter-versions";
import {
  saveCharterAction,
  rollbackCharterAction,
} from "@/lib/charter-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { active } = await resolveActiveWorkspace(supabase, user.id);
  const charter = await getActiveCharter(supabase, active.id);
  const versions = await listCharterVersions(supabase, active.id);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Accueil
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        Réglages · {active.name}
      </h1>

      <section className="mt-6">
        <h2 className="text-lg font-medium">
          Charte éditoriale{" "}
          <span className="text-muted-foreground">
            {charter.version ? `(v${charter.version})` : "(défaut)"}
          </span>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          La génération utilise cette charte. Enregistrer crée une nouvelle
          version (l&apos;historique est conservé).
        </p>
        <form action={saveCharterAction} className="mt-3 flex flex-col gap-3">
          <Label htmlFor="content" className="sr-only">
            Contenu de la charte
          </Label>
          <Textarea
            id="content"
            name="content"
            defaultValue={charter.content}
            rows={22}
            required
            className="font-mono text-xs"
          />
          <Button type="submit" className="self-start">
            Enregistrer (nouvelle version)
          </Button>
        </form>
      </section>

      {versions.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-medium">Historique</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {versions.map((version) => (
              <li
                key={version.id}
                className="flex items-center justify-between gap-4 rounded-lg border p-3 text-sm"
              >
                <span>
                  v{version.version} ·{" "}
                  {format(parseISO(version.created_at), "d MMM yyyy, HH:mm", {
                    locale: fr,
                  })}
                </span>
                {version.version === charter.version ? (
                  <span className="text-xs text-muted-foreground">active</span>
                ) : (
                  <form action={rollbackCharterAction}>
                    <input type="hidden" name="version_id" value={version.id} />
                    <Button type="submit" variant="outline" size="sm">
                      Restaurer
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
