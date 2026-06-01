import Link from "next/link";
import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { type Communication } from "@/lib/types";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { active } = await resolveActiveWorkspace(supabase, user.id);

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
        <Button asChild>
          <Link href="/communications/new">Nouvelle communication</Link>
        </Button>
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
