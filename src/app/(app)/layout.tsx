import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { getWorkspaceRole } from "@/lib/members";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { Button } from "@/components/ui/button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { active, all } = await resolveActiveWorkspace(supabase, user.id);
  const activeId = active?.id ?? "";
  const role = active
    ? await getWorkspaceRole(supabase, active.id, user.id)
    : null;

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col gap-6 border-r p-4">
        <div className="text-sm font-semibold">Content Factory</div>
        <WorkspaceSwitcher workspaces={all} activeId={activeId} />
        <nav className="flex flex-col gap-1 text-sm">
          <Link href="/" className="rounded-md px-3 py-2 hover:bg-muted">
            Dashboard
          </Link>
          <Link href="/calendar" className="rounded-md px-3 py-2 hover:bg-muted">
            Calendrier
          </Link>
          <Link href="/settings" className="rounded-md px-3 py-2 hover:bg-muted">
            Réglages
          </Link>
        </nav>
        <div className="mt-auto text-xs text-muted-foreground">
          <div className="mb-2 truncate">
            {user.email}
            {role ? ` · ${role}` : ""}
          </div>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" size="sm">
              Déconnexion
            </Button>
          </form>
        </div>
      </aside>
      <div className="flex-1">{children}</div>
    </div>
  );
}
