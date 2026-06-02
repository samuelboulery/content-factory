import Link from "next/link";
import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { getActiveContext } from "@/lib/session";
import {
  getActiveCharter,
  listCharterVersions,
} from "@/lib/charter-versions";
import {
  saveCharterAction,
  rollbackCharterAction,
  importCharterAction,
} from "@/lib/charter-actions";
import { getLatestLearning } from "@/lib/charter-learnings";
import {
  analyzeCharterAction,
  applyCharterLearningAction,
  dismissCharterLearningAction,
} from "@/lib/charter-learning-actions";
import {
  saveWorkspaceSettingsAction,
  saveNetworkChartersAction,
} from "@/lib/workspace-actions";
import {
  createTemplateAction,
  deleteTemplateAction,
} from "@/lib/template-actions";
import { getTemplateSteps } from "@/lib/template-steps";
import { listTemplates } from "@/lib/templates";
import { TemplateStepsEditor } from "@/components/TemplateStepsEditor";
import { listMembers, listPendingInvites } from "@/lib/members";
import {
  createInviteAction,
  revokeInviteAction,
  removeMemberAction,
} from "@/lib/member-actions";
import { CopyButton } from "@/components/CopyButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/SubmitButton";
import { NETWORKS } from "@/lib/networks";

const IMPORT_ERRORS: Record<string, string> = {
  empty: "Fichier vide ou illisible — aucune charte importée.",
  size: "Fichier trop volumineux (max 200 Ko).",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    imported?: string;
    importError?: string;
    learn?: string;
  }>;
}) {
  const { imported, importError, learn } = await searchParams;
  const { supabase, user, active, role } = await getActiveContext();
  if (!user) redirect("/login");
  if (!active) redirect("/");
  const isOwner = role === "owner";

  // Lectures indépendantes en parallèle (le rôle vient déjà du contexte de session).
  const [charter, versions, templates, members, invites, learning] =
    await Promise.all([
      getActiveCharter(supabase, active.id),
      listCharterVersions(supabase, active.id),
      listTemplates(supabase, active.id),
      listMembers(supabase, active.id),
      isOwner ? listPendingInvites(supabase, active.id) : Promise.resolve([]),
      isOwner ? getLatestLearning(supabase, active.id) : Promise.resolve(null),
    ]);
  const templateSteps = await Promise.all(
    templates.map((t) => getTemplateSteps(supabase, t.id)),
  );

  return (
    <main className="mx-auto max-w-3xl p-8">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Accueil
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        Réglages · {active.name}
      </h1>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Membres & invitations</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {members.map((member) => (
            <li
              key={member.user_id}
              className="flex items-center justify-between gap-4 rounded-lg border p-3 text-sm"
            >
              <span>
                {member.email}{" "}
                <span className="text-muted-foreground">· {member.role}</span>
                {member.user_id === user.id ? " (toi)" : ""}
              </span>
              {isOwner &&
              member.role !== "owner" &&
              member.user_id !== user.id ? (
                <form action={removeMemberAction}>
                  <input type="hidden" name="user_id" value={member.user_id} />
                  <Button type="submit" variant="outline" size="sm">
                    Retirer
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>

        {isOwner ? (
          <div className="mt-4 space-y-3">
            <form action={createInviteAction} className="flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="invite-role" className="text-xs">
                  Rôle
                </Label>
                <select
                  id="invite-role"
                  name="role"
                  className="h-9 rounded-md border bg-transparent px-3 text-sm"
                >
                  <option value="editor">Éditeur</option>
                  <option value="viewer">Lecteur</option>
                </select>
              </div>
              <Button type="submit">Créer un lien d&apos;invitation</Button>
            </form>

            {invites.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {invites.map((invite) => (
                  <li
                    key={invite.token}
                    className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm"
                  >
                    <span className="text-muted-foreground">{invite.role}</span>
                    <code className="truncate rounded bg-muted px-2 py-1 text-xs">
                      /invite/{invite.token}
                    </code>
                    <CopyButton value={`/invite/${invite.token}`}>
                      Copier le lien
                    </CopyButton>
                    <form action={revokeInviteAction}>
                      <input type="hidden" name="token" value={invite.token} />
                      <Button type="submit" variant="outline" size="sm">
                        Révoquer
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Seul le propriétaire peut inviter ou retirer des membres.
          </p>
        )}
      </section>

      {!isOwner ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Seul le propriétaire modifie la charte, le contexte et les réglages.
          Tu peux créer et éditer des communications.
        </p>
      ) : (
        <>
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="notification_emails">Emails de notification</Label>
            <Textarea
              id="notification_emails"
              name="notification_emails"
              rows={3}
              defaultValue={active.notification_emails.join("\n")}
              placeholder="un email par ligne (ou séparés par des virgules)"
            />
            <p className="text-xs text-muted-foreground">
              Destinataires du rappel quotidien des posts à publier. Si vide,
              l&apos;email du propriétaire du workspace est utilisé.
            </p>
          </div>
          <Button type="submit" className="self-start">
            Enregistrer le contexte
          </Button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium">Templates de communication</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Chaque template = un jeu d&apos;étapes (offset + intention), choisi à
          la création d&apos;une communication. Le nombre de posts = le nombre
          d&apos;étapes.
        </p>

        <form
          action={createTemplateAction}
          className="mt-3 flex items-end gap-2"
        >
          <Input
            name="name"
            placeholder="Nom (ex : Recrutement, Post libre)"
            required
            className="max-w-xs text-sm"
          />
          <Button type="submit">Créer un template</Button>
        </form>

        {templates.map((template, ti) => (
          <div key={template.id} className="mt-4 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-medium">{template.name}</h3>
              {templates.length > 1 ? (
                <form action={deleteTemplateAction}>
                  <input type="hidden" name="template_id" value={template.id} />
                  <Button type="submit" variant="outline" size="sm">
                    Supprimer
                  </Button>
                </form>
              ) : null}
            </div>
            <TemplateStepsEditor
              templateId={template.id}
              initialSteps={templateSteps[ti]}
            />
          </div>
        ))}
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

        {imported ? (
          <p className="mt-3 rounded-md border border-green-300 bg-green-50 p-2 text-sm text-green-800">
            Charte importée — nouvelle version active.
          </p>
        ) : null}
        {importError ? (
          <p className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
            {IMPORT_ERRORS[importError] ?? "Import impossible."}
          </p>
        ) : null}

        <form
          action={importCharterAction}
          className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border p-3"
        >
          <Label htmlFor="skill-file" className="text-sm">
            Importer un fichier{" "}
            <code className="rounded bg-muted px-1 text-xs">.skill</code>
          </Label>
          <input
            id="skill-file"
            type="file"
            name="file"
            accept=".skill,.md,.markdown,.txt"
            required
            className="flex-1 text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1 file:text-sm"
          />
          <SubmitButton pendingLabel="Import…">Importer</SubmitButton>
          <p className="w-full text-xs text-muted-foreground">
            Le frontmatter YAML est retiré ; le corps devient une nouvelle
            version de charte (l&apos;ancienne reste dans l&apos;historique).
          </p>
        </form>

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

      <section className="mt-8">
        <h2 className="text-lg font-medium">Apprentissage de la charte</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Analyse tes corrections (posts publiés après édition) pour proposer un
          ajustement de charte. Tu valides avant d&apos;appliquer.
        </p>
        {learn === "empty" ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Pas encore assez de posts édités+publiés pour analyser.
          </p>
        ) : null}
        {learn === "error" ? (
          <p className="mt-2 text-xs text-red-600">Analyse échouée. Réessaie.</p>
        ) : null}
        <form action={analyzeCharterAction} className="mt-3">
          <SubmitButton pendingLabel="Analyse… (~20s)">
            Analyser mes corrections
          </SubmitButton>
        </form>

        {learning ? (
          <div className="mt-4 rounded-lg border p-4">
            <p className="text-sm font-medium">
              Analyse · {learning.sample_size} correction(s)
            </p>
            {learning.observations.length > 0 ? (
              <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                {learning.observations.map((obs, i) => (
                  <li key={`${obs}-${i}`}>{obs}</li>
                ))}
              </ul>
            ) : null}
            {learning.addendum ? (
              <>
                <p className="mt-3 text-xs font-medium">Addendum proposé :</p>
                <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">
                  {learning.addendum}
                </pre>
              </>
            ) : null}
            <div className="mt-3 flex gap-2">
              {learning.addendum ? (
                <form action={applyCharterLearningAction}>
                  <input type="hidden" name="learning_id" value={learning.id} />
                  <SubmitButton pendingLabel="Application…">
                    Appliquer (nouvelle version)
                  </SubmitButton>
                </form>
              ) : null}
              <form action={dismissCharterLearningAction}>
                <input type="hidden" name="learning_id" value={learning.id} />
                <Button type="submit" variant="outline" size="sm">
                  Ignorer
                </Button>
              </form>
            </div>
          </div>
        ) : null}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium">Chartes par réseau</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Overlay optionnel ajouté à la charte de base selon le réseau cible de
          la communication. Laisse vide pour utiliser la charte de base seule.
        </p>
        {active.networks.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Sélectionne d&apos;abord des réseaux ciblés (section Contexte &
            réseaux ci-dessus).
          </p>
        ) : (
          <form
            action={saveNetworkChartersAction}
            className="mt-3 flex flex-col gap-4"
          >
            {active.networks.map((network) => (
              <div key={network} className="flex flex-col gap-2">
                <Label htmlFor={`overlay-${network}`}>{network}</Label>
                <Textarea
                  id={`overlay-${network}`}
                  name={`overlay::${network}`}
                  rows={4}
                  defaultValue={active.network_charters[network] ?? ""}
                  placeholder={`Ton / spécificités ${network}…`}
                  className="text-sm"
                />
              </div>
            ))}
            <Button type="submit" className="self-start">
              Enregistrer les chartes par réseau
            </Button>
          </form>
        )}
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
        </>
      )}
    </main>
  );
}
