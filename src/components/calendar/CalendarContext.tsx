import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { awsApi } from "@/lib/awsApi";
import { CalendarEvent } from "./types";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, MapPin, ExternalLink } from "lucide-react";
import { format, parseISO, isToday, isTomorrow } from "date-fns";

function formatEventTime(event: CalendarEvent): string {
  const date = parseISO(event.start);
  const prefix = isToday(date) ? "Today" : isTomorrow(date) ? "Tomorrow" : format(date, "EEE");
  if (event.all_day) return `${prefix} · All Day`;
  return `${prefix} · ${format(date, "h:mm a")}`;
}

export default function CalendarContext() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    awsApi.getCalendarEvents(user.id, 3, 0)
      .then((data) => setEvents(data.events ?? []))
      .catch(() => setEvents([]));
  }, [user?.id]);

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Calendar Context</h3>
      </div>
      {events === null ? (
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      ) : events.length === 0 ? (
        <p className="text-xs text-muted-foreground">No upcoming events</p>
      ) : (
        <div className="space-y-2">
          {events.slice(0, 4).map((event) => (
            <button
              key={event.id}
              onClick={() => event.html_link && window.open(event.html_link, "_blank")}
              className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/50"
              disabled={!event.html_link}
            >
              <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{event.title}</p>
                <p className="text-[11px] text-muted-foreground">{formatEventTime(event)}</p>
                {event.location && (
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="h-2.5 w-2.5" />
                    <span className="truncate">{event.location}</span>
                  </p>
                )}
              </div>
              {event.html_link && <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground mt-0.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
