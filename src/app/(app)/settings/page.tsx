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
import { saveWorkspaceSettingsAction } from "@/lib/workspace-actions";
import { saveTemplateStepsAction } from "@/lib/template-actions";
import { getTemplateSteps } from "@/lib/template-steps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const NETWORKS = ["LinkedIn", "Instagram", "Facebook", "Twitter/X"];

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { active } = await resolveActiveWorkspace(supabase, user.id);
  const charter = await getActiveCharter(supabase, active.id);
  const versions = await listCharterVersions(supabase, active.id);
  const steps = await getTemplateSteps(supabase, active.id);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Accueil
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        Réglages · {active.name}
      </h1>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Contexte & réseaux</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Le contexte général aide l&apos;IA à comprendre le périmètre. Il est
          injecté dans la génération.
        </p>
        <form
          action={saveWorkspaceSettingsAction}
          className="mt-3 flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="context">Contexte général</Label>
            <Textarea
              id="context"
              name="context"
              rows={4}
              defaultValue={active.context ?? ""}
              placeholder="Qui est l'asso, son périmètre, son public cible…"
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Réseaux ciblés</span>
            <div className="flex flex-wrap gap-4">
              {NETWORKS.map((network) => (
                <label
                  key={network}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    name="networks"
                    value={network}
                    defaultChecked={active.networks.includes(network)}
                    className="size-4"
                  />
                  {network}
                </label>
              ))}
            </div>
          </div>
          <Button type="submit" className="self-start">
            Enregistrer le contexte
          </Button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium">Rétroplanning (template Event)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Offsets (en jours, négatifs avant l&apos;événement) + intention de
          chaque post. Utilisé pour la génération chaînée.
        </p>
        <form
          action={saveTemplateStepsAction}
          className="mt-3 flex flex-col gap-3"
        >
          {steps.map((step, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Label htmlFor={`offset-${i}`} className="text-xs">
                  Jour (offset)
                </Label>
                <Input
                  id={`offset-${i}`}
                  name="offset_days"
                  type="number"
                  defaultValue={step.offset_days}
                  required
                  className="w-24"
                />
                <Input
                  name="info_required"
                  defaultValue={step.info_required ?? ""}
                  placeholder="Info attendue (ex : date + lieu)"
                  className="flex-1 text-sm"
                />
              </div>
              <Textarea
                name="intention"
                defaultValue={step.intention}
                rows={2}
                required
                placeholder="Intention narrative du post"
                className="text-sm"
              />
            </div>
          ))}
          <Button type="submit" className="self-start">
            Enregistrer le rétroplanning
          </Button>
        </form>
      </section>

      <section className="mt-8">
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
