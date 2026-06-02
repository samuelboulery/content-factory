import { createClient } from "@/lib/supabase/server";
import { acceptInviteAction } from "@/lib/member-actions";
import { SubmitButton } from "@/components/SubmitButton";

function roleLabel(role: string): string {
  if (role === "viewer") return "lecteur (lecture seule)";
  return "éditeur (peut créer des communications)";
}

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase.rpc("get_invite_public", { p_token: token });
  const invite =
    Array.isArray(data) && data.length > 0
      ? (data[0] as { workspace_name: string; role: string; valid: boolean })
      : null;

  if (!invite || !invite.valid) {
    return (
      <main className="mx-auto max-w-md p-8">
        <p className="text-sm text-muted-foreground">
          Invitation invalide, déjà utilisée ou expirée.
        </p>
      </main>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Invitation</h1>
      <p className="mt-2 text-muted-foreground">
        Tu es invité·e à rejoindre{" "}
        <strong className="text-foreground">{invite.workspace_name}</strong> en
        tant que <strong className="text-foreground">{roleLabel(invite.role)}</strong>.
      </p>

      {error ? (
        <p className="mt-4 text-sm text-red-600">
          L&apos;acceptation a échoué (invitation expirée ou déjà utilisée).
        </p>
      ) : null}

      {user ? (
        <form action={acceptInviteAction} className="mt-6">
          <input type="hidden" name="token" value={token} />
          <SubmitButton pendingLabel="Ajout en cours…">
            Rejoindre le workspace
          </SubmitButton>
        </form>
      ) : (
        <a
          href={`/login?next=/invite/${token}`}
          className="mt-6 inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Se connecter pour rejoindre
        </a>
      )}
    </main>
  );
}
