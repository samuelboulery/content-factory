import type { PostStatus } from "@/lib/types";

/** Une étape de la timeline = un post positionné relativement à l'événement. */
export interface TimelineItem {
  id: string;
  offsetLabel: string; // "J-30", "Jour J", "J+2"
  dateLabel: string; // "3 mai 2026"
  status: PostStatus;
  title: string; // so_what ou aperçu du contenu
}

interface CommunicationTimelineProps {
  items: TimelineItem[];
  eventDateLabel: string;
}

// Point de la timeline : vert si publié, ambre sinon (cohérent avec le calendrier).
function dotClasses(status: PostStatus): string {
  return status === "published"
    ? "bg-green-600 border-green-600"
    : "bg-background border-amber-400";
}

/** Timeline verticale du rétroplanning d'une communication (US-7.3). */
export function CommunicationTimeline({
  items,
  eventDateLabel,
}: CommunicationTimelineProps) {
  if (items.length === 0) return null;

  return (
    <ol className="relative ml-3 flex flex-col gap-5 border-l pl-6">
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span
            className={`absolute top-1 -left-[1.95rem] size-3 rounded-full border-2 ${dotClasses(item.status)}`}
            aria-hidden
          />
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-medium">{item.offsetLabel}</span>
            <span className="text-xs text-muted-foreground">
              {item.dateLabel}
            </span>
            {item.status === "published" ? (
              <span className="text-xs text-green-700">· publié</span>
            ) : (
              <span className="text-xs text-amber-700">· à publier</span>
            )}
          </div>
          <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
            {item.title}
          </p>
        </li>
      ))}
      <li className="relative">
        <span
          className="absolute top-1 -left-[2.05rem] size-4 rounded-full border-2 border-foreground bg-foreground"
          aria-hidden
        />
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-semibold">🎯 Événement</span>
          <span className="text-xs text-muted-foreground">
            {eventDateLabel}
          </span>
        </div>
      </li>
    </ol>
  );
}
