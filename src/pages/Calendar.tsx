import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { awsApi } from "@/lib/awsApi";
import { CalendarEvent } from "@/components/calendar/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  MapPin,
  Users,
  X,
  ExternalLink,
} from "lucide-react";
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  format,
  parseISO,
  isSameDay,
  differenceInMinutes,
  isWithinInterval,
  eachDayOfInterval,
  startOfDay,
} from "date-fns";

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8AM - 6PM

function getDemoEvents(): CalendarEvent[] {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });

  const makeEvent = (
    dayOffset: number,
    startHour: number,
    startMin: number,
    durationMin: number,
    title: string,
    opts: Partial<CalendarEvent> = {}
  ): CalendarEvent => {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + dayOffset);
    const start = new Date(day);
    start.setHours(startHour, startMin, 0, 0);
    const end = new Date(start.getTime() + durationMin * 60000);
    return {
      id: `demo-${dayOffset}-${startHour}`,
      title,
      start: start.toISOString(),
      end: end.toISOString(),
      all_day: false,
      ...opts,
    };
  };

  return [
    makeEvent(0, 9, 0, 60, "Team Standup", {
      location: "Zoom",
      participants: [{ name: "Alice", email: "alice@co.com" }, { name: "Bob", email: "bob@co.com" }],
    }),
    makeEvent(0, 14, 0, 30, "1:1 with Manager", { location: "Room 3B" }),
    makeEvent(1, 10, 0, 90, "Client Review – Acme Corp", {
      location: "Google Meet",
      description: "Q1 deliverables review with the Acme team.",
      participants: [{ name: "Sarah Chen", email: "sarah@acme.com" }],
    }),
    makeEvent(2, 11, 0, 60, "Product Demo", { location: "Main Conference Room" }),
    makeEvent(2, 15, 30, 45, "Design Sync", { location: "Figma" }),
    makeEvent(3, 9, 30, 60, "Sprint Planning", {
      location: "Zoom",
      participants: [
        { name: "Dev Team", email: "dev@co.com" },
        { name: "PM", email: "pm@co.com" },
      ],
    }),
    makeEvent(3, 13, 0, 30, "Lunch & Learn: AI Tools"),
    makeEvent(4, 10, 0, 120, "Quarterly Review", {
      location: "Board Room",
      description: "All-hands quarterly performance review.",
    }),
    makeEvent(4, 16, 0, 60, "Happy Hour 🍻", { location: "Rooftop Lounge" }),
  ];
}
const HOUR_HEIGHT = 60; // px per hour

function getEventPosition(event: CalendarEvent) {
  const start = parseISO(event.start);
  const end = parseISO(event.end);
  const startHour = start.getHours() + start.getMinutes() / 60;
  const endHour = end.getHours() + end.getMinutes() / 60;
  const clampedStart = Math.max(startHour, 8);
  const clampedEnd = Math.min(endHour, 19);
  const top = (clampedStart - 8) * HOUR_HEIGHT;
  const height = Math.max((clampedEnd - clampedStart) * HOUR_HEIGHT, 20);
  return { top, height };
}

export default function CalendarPage() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const weekEnd = useMemo(() => endOfWeek(weekStart, { weekStartsOn: 1 }), [weekStart]);
  const days = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);

  const fetchEvents = useCallback(async () => {
    if (!user?.id) return;
    setEvents(null);
    try {
      const data = await awsApi.getCalendarEvents(user.id, 14, 7);
      const apiEvents = data.events ?? [];
      // Use demo events as fallback when no real events exist
      setEvents(apiEvents.length > 0 ? apiEvents : getDemoEvents());
    } catch {
      setEvents(getDemoEvents());
    }
  }, [user?.id]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const eventsForDay = useCallback(
    (day: Date) => {
      if (!events) return [];
      return events.filter((e) => {
        const eventDate = parseISO(e.start);
        return isSameDay(eventDate, day);
      });
    },
    [events]
  );

  const allDayEvents = useCallback(
    (day: Date) => eventsForDay(day).filter((e) => e.all_day),
    [eventsForDay]
  );

  const timedEvents = useCallback(
    (day: Date) => eventsForDay(day).filter((e) => !e.all_day),
    [eventsForDay]
  );

  const isCurrentWeek = isSameDay(startOfWeek(new Date(), { weekStartsOn: 1 }), weekStart);

  const eventColors = [
    "bg-primary/20 border-primary/40 text-primary",
    "bg-emerald-500/20 border-emerald-500/40 text-emerald-400",
    "bg-orange-500/20 border-orange-500/40 text-orange-400",
    "bg-purple-500/20 border-purple-500/40 text-purple-400",
    "bg-pink-500/20 border-pink-500/40 text-pink-400",
  ];

  function getEventColor(idx: number) {
    return eventColors[idx % eventColors.length];
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-3">
          <CalendarIcon className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
            }}
            disabled={isCurrentWeek}
          >
            Today
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart((w) => subWeeks(w, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[160px] text-center text-sm font-medium text-foreground">
            {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart((w) => addWeeks(w, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {events === null ? (
        <div className="flex-1 p-6">
          <div className="grid grid-cols-8 gap-px">
            {Array.from({ length: 8 * 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        </div>
      ) : events.length === 0 && !events ? (
        <div className="flex flex-1 flex-col items-center justify-center">
          <CalendarIcon className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No events this week</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {/* Day headers */}
          <div className="sticky top-0 z-10 grid grid-cols-[60px_repeat(7,1fr)] border-b border-border bg-card">
            <div className="border-r border-border" />
            {days.map((day) => {
              const isToday = isSameDay(day, new Date());
              return (
                <div key={day.toISOString()} className="border-r border-border px-2 py-2 text-center last:border-r-0">
                  <p className="text-[11px] text-muted-foreground uppercase">{format(day, "EEE")}</p>
                  <p className={`text-lg font-semibold ${isToday ? "text-primary" : "text-foreground"}`}>
                    {format(day, "d")}
                  </p>
                  {/* All-day events */}
                  {allDayEvents(day).map((event, idx) => (
                    <button
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      className={`mt-1 w-full truncate rounded px-1.5 py-0.5 text-[10px] font-medium border ${getEventColor(idx)}`}
                    >
                      {event.title}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)]">
            {/* Time labels */}
            <div className="border-r border-border">
              {HOURS.map((hour) => (
                <div key={hour} className="relative" style={{ height: HOUR_HEIGHT }}>
                  <span className="absolute -top-2 right-2 text-[11px] text-muted-foreground">
                    {format(new Date(2000, 0, 1, hour), "h a")}
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day) => (
              <div key={day.toISOString()} className="relative border-r border-border last:border-r-0">
                {HOURS.map((hour) => (
                  <div key={hour} className="border-b border-border/50" style={{ height: HOUR_HEIGHT }} />
                ))}
                {/* Event blocks */}
                {timedEvents(day).map((event, idx) => {
                  const { top, height } = getEventPosition(event);
                  return (
                    <button
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      className={`absolute left-0.5 right-0.5 overflow-hidden rounded border px-1.5 py-0.5 text-left transition-colors hover:brightness-110 ${getEventColor(idx)}`}
                      style={{ top, height, minHeight: 20 }}
                    >
                      <p className="truncate text-[11px] font-medium leading-tight">{event.title}</p>
                      {height > 30 && (
                        <p className="truncate text-[10px] opacity-70">
                          {format(parseISO(event.start), "h:mm a")}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Event detail modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={() => setSelectedEvent(null)}>
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">{selectedEvent.title}</h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedEvent(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarIcon className="h-4 w-4 shrink-0" />
                {selectedEvent.all_day ? (
                  <span>{format(parseISO(selectedEvent.start), "EEEE, MMMM d")} · All Day</span>
                ) : (
                  <span>
                    {format(parseISO(selectedEvent.start), "EEEE, MMMM d · h:mm a")} –{" "}
                    {format(parseISO(selectedEvent.end), "h:mm a")}
                  </span>
                )}
              </div>
              {selectedEvent.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span>{selectedEvent.location}</span>
                </div>
              )}
              {selectedEvent.participants && selectedEvent.participants.length > 0 && (
                <div className="flex items-start gap-2 text-muted-foreground">
                  <Users className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    {selectedEvent.participants.map((p, i) => (
                      <p key={i} className="text-xs">{p.name || p.email}</p>
                    ))}
                  </div>
                </div>
              )}
              {selectedEvent.description && (
                <p className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-3 mt-3">
                  {selectedEvent.description}
                </p>
              )}
              {selectedEvent.html_link && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 gap-2"
                  onClick={() => window.open(selectedEvent.html_link, "_blank")}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open in Calendar
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
