import Link from "next/link";
import { redirect } from "next/navigation";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { fr } from "date-fns/locale";
import { getActiveContext } from "@/lib/session";
import { cn } from "@/lib/utils";

type CalendarPost = {
  id: string;
  communication_id: string;
  scheduled_date: string;
  status: string;
  network: string;
};

const WEEKDAYS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const { supabase, user, active } = await getActiveContext();
  if (!user) redirect("/login");
  if (!active) redirect("/");

  const base =
    month && /^\d{4}-\d{2}$/.test(month) ? parseISO(`${month}-01`) : new Date();
  const monthStart = startOfMonth(base);
  const monthEnd = endOfMonth(base);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  // Communications du workspace actif (pour le nom + le filtrage des posts).
  const { data: commData } = await supabase
    .from("communications")
    .select("id, name")
    .eq("workspace_id", active.id);
  const coms = (commData ?? []) as { id: string; name: string }[];
  const comName = new Map(coms.map((c) => [c.id, c.name]));
  const comIds = coms.map((c) => c.id);

  let posts: CalendarPost[] = [];
  if (comIds.length > 0) {
    const { data: postData } = await supabase
      .from("posts")
      .select("id, communication_id, scheduled_date, status, network")
      .in("communication_id", comIds)
      .gte("scheduled_date", format(monthStart, "yyyy-MM-dd"))
      .lte("scheduled_date", format(monthEnd, "yyyy-MM-dd"));
    posts = (postData ?? []) as CalendarPost[];
  }

  const byDay = new Map<string, CalendarPost[]>();
  for (const post of posts) {
    const list = byDay.get(post.scheduled_date) ?? [];
    list.push(post);
    byDay.set(post.scheduled_date, list);
  }

  const monthLabel = format(base, "LLLL yyyy", { locale: fr });
  const prevMonth = format(addMonths(base, -1), "yyyy-MM");
  const nextMonth = format(addMonths(base, 1), "yyyy-MM");

  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight capitalize">
          {monthLabel}
        </h1>
        <div className="flex gap-2 text-sm">
          <Link
            href={`/calendar?month=${prevMonth}`}
            className="rounded-md border px-3 py-1.5 hover:bg-muted"
          >
            ← Mois précédent
          </Link>
          <Link
            href={`/calendar?month=${nextMonth}`}
            className="rounded-md border px-3 py-1.5 hover:bg-muted"
          >
            Mois suivant →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-xs">
        {WEEKDAYS.map((weekday) => (
          <div
            key={weekday}
            className="bg-muted px-2 py-1 text-center font-medium text-muted-foreground"
          >
            {weekday}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayPosts = byDay.get(key) ?? [];
          return (
            <div
              key={key}
              className={cn(
                "min-h-24 bg-background p-1",
                !isSameMonth(day, base) && "bg-muted/40 text-muted-foreground",
              )}
            >
              <div className="mb-1 text-right text-[11px] text-muted-foreground">
                {format(day, "d")}
              </div>
              <div className="flex flex-col gap-1">
                {dayPosts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/communications/${post.communication_id}`}
                    className={cn(
                      "block truncate rounded px-1 py-0.5",
                      post.status === "published"
                        ? "bg-green-600/15 text-green-800"
                        : "bg-primary/10 hover:bg-primary/20",
                    )}
                    title={`${post.network} — ${comName.get(post.communication_id) ?? ""}`}
                  >
                    <span className="text-muted-foreground">{post.network}</span>{" "}
                    {comName.get(post.communication_id) ?? "?"}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Workspace : {active.name}. Les posts publiés apparaissent en vert.
      </p>
    </main>
  );
}
