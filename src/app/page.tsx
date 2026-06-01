import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateTdsWorkspace } from "@/lib/workspace";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspace = await getOrCreateTdsWorkspace(supabase, user.id);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col p-8">
      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <span>
          {workspace.name} · {user.email}
        </span>
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="outline" size="sm">
            Déconnexion
          </Button>
        </form>
      </div>

      <div className="flex flex-1 flex-col items-start justify-center gap-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          Content Factory — TDS workspace
        </h1>
        <p className="text-muted-foreground">
          Atelier de création éditoriale assisté par IA pour The Design Society.
        </p>
        <Button asChild>
          <Link href="/communications/new">Nouvelle communication</Link>
        </Button>
      </div>
    </main>
  );
}
