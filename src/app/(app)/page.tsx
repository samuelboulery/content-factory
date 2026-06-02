import Link from "next/link";
import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { getActiveContext } from "@/lib/session";
import { type Communication } from "@/lib/types";

export default async function Home() {
  const { supabase, user, active, role } = await getActiveContext();
  if (!user) redirect("/login");

  // Aucun workspace : onboarding (créer dans la sidebar ou rejoindre via invitation).
  if (!active) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Bienvenue</h1>
        <p className="mt-2 text-muted-foreground">
          Tu n&apos;as pas encore de workspace. Crée-en un depuis la barre
          latérale, ou rejoins-en un via un lien d&apos;invitation.
        </p>
      </main>
    );
  }

  const canCreate = role === "owner" || role === "editor";

  const { data } = await supabase
    .from("communications")
    .select("*")
    .eq("workspace_id", active.id)
    .order("created_at", { ascending: false });
  const communications = (data ?? []) as Communication[];

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{active.name}</h1>
        {canCreate ? (
          <Button asChild>
            <Link href="/communications/new">Nouvelle communication</Link>
          </Button>
        ) : null}
      </div>

      {communications.length === 0 ? (
        <p className="text-muted-foreground">
          Aucune communication pour l&apos;instant. Crée la première.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {communications.map((comm) => (
            <li key={comm.id}>
              <Link
                href={`/communications/${comm.id}`}
                className="block rounded-lg border p-4 transition-colors hover:bg-muted"
              >
                <div className="font-medium">{comm.name}</div>
                <div className="text-sm text-muted-foreground">
                  {format(parseISO(comm.event_date), "d MMMM yyyy", {
                    locale: fr,
                  })}
                  {comm.event_location ? ` · ${comm.event_location}` : ""}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
