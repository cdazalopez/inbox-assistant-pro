import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { awsApi } from "@/lib/awsApi";
import { CalendarEvent } from "./types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, RefreshCw, MapPin, ExternalLink } from "lucide-react";
import { format, parseISO, isToday, isTomorrow } from "date-fns";

function formatEventDate(dateStr: string, allDay: boolean): string {
  const date = parseISO(dateStr);
  const prefix = isToday(date) ? "Today" : isTomorrow(date) ? "Tomorrow" : format(date, "EEE, MMM d");
  if (allDay) return `${prefix} · All Day`;
  return `${prefix} · ${format(date, "h:mm a")}`;
}

export default function UpcomingMeetingsWidget() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [syncing, setSyncing] = useState(false);

  const fetchEvents = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await awsApi.getCalendarEvents(user.id, 3, 0);
      setEvents(data.events ?? []);
    } catch {
      setEvents([]);
    }
  }, [user?.id]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleSync = async () => {
    setSyncing(true);
    await fetchEvents();
    setSyncing(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Upcoming Meetings</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSync} disabled={syncing} className="h-7 px-2">
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <div className="divide-y divide-border">
        {events === null ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-5 py-3 space-y-1.5">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Calendar className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No upcoming meetings</p>
          </div>
        ) : (
          events.slice(0, 5).map((event) => (
            <button
              key={event.id}
              onClick={() => event.html_link && window.open(event.html_link, "_blank")}
              className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/30"
              disabled={!event.html_link}
            >
              <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                <p className="text-xs text-muted-foreground">{formatEventDate(event.start, event.all_day)}</p>
                {event.location && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{event.location}</span>
                  </p>
                )}
              </div>
              {event.html_link && <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
