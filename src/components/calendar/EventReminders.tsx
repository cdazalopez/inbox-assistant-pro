import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { awsApi } from "@/lib/awsApi";
import { CalendarEvent } from "@/components/calendar/types";
import { isSameDay, format, parseISO, isToday, isTomorrow } from "date-fns";
import { Calendar, ChevronRight } from "lucide-react";

export default function EventReminders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const fetchEvents = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await awsApi.getCalendarEvents(user.id, 2, 0);
      setEvents(data.events ?? []);
    } catch {
      setEvents([]);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const todayEvents = events.filter((e) => isToday(parseISO(e.start)));
  const tomorrowEvents = events.filter((e) => isTomorrow(parseISO(e.start)));

  if (todayEvents.length === 0 && tomorrowEvents.length === 0) return null;

  return (
    <div className="space-y-2">
      {todayEvents.length > 0 && (
        <button
          onClick={() => navigate("/calendar")}
          className="flex w-full items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-left transition-colors hover:bg-primary/10"
        >
          <Calendar className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              📅 You have {todayEvents.length} event{todayEvents.length !== 1 ? "s" : ""} today
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {todayEvents
                .slice(0, 2)
                .map((e) =>
                  e.all_day
                    ? e.title
                    : `${e.title} at ${format(parseISO(e.start), "h:mm a")}`
                )
                .join(" · ")}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      )}
      {tomorrowEvents.length > 0 && (
        <button
          onClick={() => navigate("/calendar")}
          className="flex w-full items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 text-left transition-colors hover:bg-muted/50"
        >
          <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              📅 {tomorrowEvents.length} event{tomorrowEvents.length !== 1 ? "s" : ""} tomorrow
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {tomorrowEvents
                .slice(0, 2)
                .map((e) => e.title)
                .join(" · ")}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      )}
    </div>
  );
}
