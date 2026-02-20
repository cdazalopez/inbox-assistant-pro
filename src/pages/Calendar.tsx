import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { awsApi } from "@/lib/awsApi";
import { CalendarEvent } from "@/components/calendar/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import CreateEventModal from "@/components/calendar/CreateEventModal";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  MapPin,
  Users,
  X,
  ExternalLink,
  Sparkles,
  Loader2,
  LayoutGrid,
  CalendarDays,
  Plus,
  Clock,
  Mail,
} from "lucide-react";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  format,
  parseISO,
  isSameDay,
  isSameMonth,
  isToday,
  eachDayOfInterval,
  differenceInMinutes,
  getHours,
  getMinutes,
} from "date-fns";

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);
const HOUR_HEIGHT = 64;

const ACCOUNT_PALETTES = [
  {
    bg: "bg-blue-500/20",
    border: "border-blue-500/50",
    text: "text-blue-300",
    dot: "bg-blue-400",
    pill: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  },
  {
    bg: "bg-emerald-500/20",
    border: "border-emerald-500/50",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
    pill: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  {
    bg: "bg-purple-500/20",
    border: "border-purple-500/50",
    text: "text-purple-300",
    dot: "bg-purple-400",
    pill: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  },
  {
    bg: "bg-orange-500/20",
    border: "border-orange-500/50",
    text: "text-orange-300",
    dot: "bg-orange-400",
    pill: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  },
];

type ViewMode = "week" | "month";
interface Account {
  id: string;
  email: string;
  provider: string;
}

function getEventPosition(event: CalendarEvent) {
  const start = parseISO(event.start);
  const end = parseISO(event.end);
  const startHour = getHours(start) + getMinutes(start) / 60;
  const endHour = getHours(end) + getMinutes(end) / 60;
  const clampedStart = Math.max(startHour, 7);
  const clampedEnd = Math.min(endHour, 21);
  const top = (clampedStart - 7) * HOUR_HEIGHT;
  const height = Math.max((clampedEnd - clampedStart) * HOUR_HEIGHT, 24);
  return { top, height };
}

function parseAIEventText(text: string): { title: string; start: Date; end: Date } | null {
  try {
    const now = new Date();
    const lower = text.toLowerCase();
    const timeMatch = lower.match(/at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
    let hour = 9,
      minute = 0;
    if (timeMatch) {
      hour = parseInt(timeMatch[1]);
      minute = parseInt(timeMatch[2] || "0");
      if (timeMatch[3] === "pm" && hour < 12) hour += 12;
      if (timeMatch[3] === "am" && hour === 12) hour = 0;
    }
    let targetDate = new Date(now);
    if (lower.includes("tomorrow")) targetDate.setDate(now.getDate() + 1);
    else if (lower.includes("monday")) targetDate = nextWeekday(now, 1);
    else if (lower.includes("tuesday")) targetDate = nextWeekday(now, 2);
    else if (lower.includes("wednesday")) targetDate = nextWeekday(now, 3);
    else if (lower.includes("thursday")) targetDate = nextWeekday(now, 4);
    else if (lower.includes("friday")) targetDate = nextWeekday(now, 5);
    else if (lower.includes("saturday")) targetDate = nextWeekday(now, 6);
    else if (lower.includes("sunday")) targetDate = nextWeekday(now, 0);
    const durationMatch = lower.match(/(\d+)\s*(hour|hr|minute|min)/);
    let durationMin = 60;
    if (durationMatch) durationMin = parseInt(durationMatch[1]) * (durationMatch[2].startsWith("h") ? 60 : 1);
    const start = new Date(targetDate);
    start.setHours(hour, minute, 0, 0);
    const end = new Date(start.getTime() + durationMin * 60000);
    const title = text
      .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, "")
      .replace(/\b(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, "")
      .replace(/\b\d+\s*(?:hour|hr|minute|min)s?\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    return { title: title || text, start, end };
  } catch {
    return null;
  }
}

function nextWeekday(from: Date, day: number): Date {
  const result = new Date(from);
  const diff = (day - result.getDay() + 7) % 7 || 7;
  result.setDate(result.getDate() + diff);
  return result;
}

export default function CalendarPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const initialEventId = searchParams.get("eventId");

  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set(["all"]));
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createInitialDate, setCreateInitialDate] = useState<Date | undefined>();
  const [createInitialHour, setCreateInitialHour] = useState<number | undefined>();
  const [aiInput, setAiInput] = useState("");
  const [aiParsed, setAiParsed] = useState<{ title: string; start: Date; end: Date } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const currentTimeRef = useRef<HTMLDivElement>(null);

  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const weekEnd = useMemo(() => endOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate]);
  const monthEnd = useMemo(() => endOfMonth(currentDate), [currentDate]);
  const weekDays = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);
  const monthGrid = useMemo(() => {
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [monthStart, monthEnd]);

  useEffect(() => {
    if (!user?.id) return;
    awsApi
      .getAccounts(user.id)
      .then((data: any) => {
        const accs: Account[] = Array.isArray(data) ? data : (data.accounts ?? []);
        setAccounts(accs);
      })
      .catch(() => {});
  }, [user?.id]);

  const fetchEvents = useCallback(async () => {
    if (!user?.id) return;
    setEvents(null);
    try {
      const daysAhead = viewMode === "month" ? 45 : 14;
      const daysBehind = viewMode === "month" ? 45 : 7;
      const accountsToFetch = selectedAccountIds.has("all") ? accounts.map((a) => a.id) : [...selectedAccountIds];

      if (accountsToFetch.length === 0) {
        const data = await awsApi.getCalendarEvents(user.id, daysAhead, daysBehind);
        setEvents(data.events ?? []);
        return;
      }

      const allEvents: CalendarEvent[] = [];
      for (const accountId of accountsToFetch) {
        try {
          const data = await awsApi.getCalendarEvents(user.id, daysAhead, daysBehind, accountId);
          const evts = (data.events ?? []).map((e: CalendarEvent) => ({ ...e, _account_id: accountId }));
          allEvents.push(...evts);
        } catch {}
      }
      setEvents(allEvents);
    } catch {
      setEvents([]);
    }
  }, [user?.id, selectedAccountIds, accounts, viewMode]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (currentTimeRef.current) {
      setTimeout(() => currentTimeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
    }
  }, [events]);

  useEffect(() => {
    if (initialEventId && events && !selectedEvent) {
      const target = events.find((e) => e.id === initialEventId);
      if (target) setSelectedEvent(target);
    }
  }, [initialEventId, events]);

  const toggleAccount = (accountId: string) => {
    if (accountId === "all") {
      setSelectedAccountIds(new Set(["all"]));
      return;
    }
    const next = new Set(selectedAccountIds);
    next.delete("all");
    if (next.has(accountId)) {
      next.delete(accountId);
      if (next.size === 0) next.add("all");
    } else next.add(accountId);
    setSelectedAccountIds(next);
  };

  const getAccountIndex = (event: CalendarEvent) => {
    const id = (event as any)._account_id;
    if (!id) return 0;
    const idx = accounts.findIndex((a) => a.id === id);
    return idx >= 0 ? idx : 0;
  };
  const getEventPalette = (event: CalendarEvent) => ACCOUNT_PALETTES[getAccountIndex(event) % ACCOUNT_PALETTES.length];
  const eventsForDay = useCallback(
    (day: Date) => (events ?? []).filter((e) => isSameDay(parseISO(e.start), day)),
    [events],
  );

  const goBack = () =>
    viewMode === "week" ? setCurrentDate((d) => subWeeks(d, 1)) : setCurrentDate((d) => subMonths(d, 1));
  const goForward = () =>
    viewMode === "week" ? setCurrentDate((d) => addWeeks(d, 1)) : setCurrentDate((d) => addMonths(d, 1));
  const headerLabel =
    viewMode === "week"
      ? `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`
      : format(currentDate, "MMMM yyyy");

  const now = new Date();
  const currentTimeTop = (getHours(now) + getMinutes(now) / 60 - 7) * HOUR_HEIGHT;
  const todayColIndex = weekDays.findIndex((d) => isToday(d));

  const handleAiInput = (text: string) => {
    setAiInput(text);
    setAiParsed(text.length > 5 ? parseAIEventText(text) : null);
  };

  const handleAiCreate = async () => {
    if (!aiParsed || !user?.id) return;
    setAiLoading(true);
    try {
      const accountId = selectedAccountIds.has("all") ? accounts[0]?.id : [...selectedAccountIds][0];
      await awsApi.createCalendarEvent({
        user_id: user.id,
        title: aiParsed.title,
        start_time: aiParsed.start.toISOString(),
        end_time: aiParsed.end.toISOString(),
        account_id: accountId,
      });
      toast({ title: `✅ "${aiParsed.title}" added` });
      setAiInput("");
      setAiParsed(null);
      fetchEvents();
    } catch {
      toast({ title: "Failed to create event", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreateEvent = async (data: any) => {
    if (!user?.id) return;
    const accountId = data.account_id || (selectedAccountIds.has("all") ? accounts[0]?.id : [...selectedAccountIds][0]);
    await awsApi.createCalendarEvent({ user_id: user.id, account_id: accountId, ...data });
    toast({ title: "✅ Event created" });
    fetchEvents();
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="flex flex-col gap-2 border-b border-border bg-card px-4 pt-3 pb-2 shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Calendar</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setViewMode("week")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "week" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
              >
                <CalendarDays className="h-3.5 w-3.5" /> Week
              </button>
              <button
                onClick={() => setViewMode("month")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Month
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="text-xs h-8">
              Today
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goBack}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[180px] text-center text-sm font-semibold text-foreground">{headerLabel}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goForward}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => {
                setCreateInitialDate(new Date());
                setCreateModalOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" /> New Event
            </Button>
          </div>
        </div>

        {/* Account filters + AI quick-add */}
        <div className="flex items-center gap-3 flex-wrap">
          {accounts.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-muted-foreground font-medium shrink-0">Show:</span>
              <button
                onClick={() => toggleAccount("all")}
                className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${selectedAccountIds.has("all") ? "bg-primary/20 border-primary/50 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}
              >
                All accounts
              </button>
              {accounts.map((account, idx) => {
                const palette = ACCOUNT_PALETTES[idx % ACCOUNT_PALETTES.length];
                const isSelected = selectedAccountIds.has(account.id);
                return (
                  <button
                    key={account.id}
                    onClick={() => toggleAccount(account.id)}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${isSelected ? `${palette.pill} border` : "border-border text-muted-foreground hover:border-primary/30"}`}
                  >
                    <div className={`h-2 w-2 rounded-full ${isSelected ? palette.dot : "bg-muted-foreground/40"}`} />
                    {account.email.split("@")[0]}
                    <span className="opacity-50 capitalize">({account.provider})</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* AI Quick-add */}
          <div className="flex items-center gap-2 flex-1 min-w-0 ml-auto max-w-lg">
            <div className="relative flex-1 min-w-0">
              <Sparkles className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary/60" />
              <Input
                className="pl-8 h-8 text-xs"
                placeholder='Try: "Lunch with Sarah Friday at noon"'
                value={aiInput}
                onChange={(e) => handleAiInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && aiParsed) handleAiCreate();
                }}
              />
            </div>
            {aiParsed && (
              <>
                <div className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                  <span className="text-foreground font-medium">{aiParsed.title}</span>
                  {" · "}
                  {format(aiParsed.start, "EEE MMM d, h:mm a")}
                </div>
                <Button size="sm" className="h-8 text-xs px-3 shrink-0" onClick={handleAiCreate} disabled={aiLoading}>
                  {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add ✓"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      {events === null ? (
        <div className="flex-1 p-4 grid grid-cols-8 gap-1 content-start">
          {Array.from({ length: 56 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : viewMode === "week" ? (
        <div className="flex-1 overflow-auto">
          {/* Day headers */}
          <div className="sticky top-0 z-10 grid grid-cols-[56px_repeat(7,1fr)] border-b border-border bg-card">
            <div className="border-r border-border" />
            {weekDays.map((day) => {
              const isTodayDay = isToday(day);
              return (
                <div key={day.toISOString()} className="border-r border-border px-1 py-2 text-center last:border-r-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{format(day, "EEE")}</p>
                  <div
                    className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${isTodayDay ? "bg-primary text-primary-foreground" : "text-foreground"}`}
                  >
                    {format(day, "d")}
                  </div>
                  {eventsForDay(day)
                    .filter((e) => e.all_day)
                    .map((event) => {
                      const p = getEventPalette(event);
                      return (
                        <button
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          className={`mt-1 w-full truncate rounded px-1 py-0.5 text-[10px] font-medium border ${p.bg} ${p.border} ${p.text}`}
                        >
                          {event.title}
                        </button>
                      );
                    })}
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="grid grid-cols-[56px_repeat(7,1fr)]">
            <div className="border-r border-border">
              {HOURS.map((hour) => (
                <div key={hour} className="relative" style={{ height: HOUR_HEIGHT }}>
                  <span className="absolute -top-2.5 right-2 text-[10px] text-muted-foreground">
                    {format(new Date(2000, 0, 1, hour), "h a")}
                  </span>
                </div>
              ))}
            </div>
            {weekDays.map((day, dayIdx) => (
              <div key={day.toISOString()} className="relative border-r border-border last:border-r-0">
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className={`border-b border-border/40 cursor-pointer hover:bg-primary/5 transition-colors ${isToday(day) ? "bg-primary/[0.02]" : ""}`}
                    style={{ height: HOUR_HEIGHT }}
                    onClick={() => {
                      setCreateInitialDate(day);
                      setCreateInitialHour(hour);
                      setCreateModalOpen(true);
                    }}
                  />
                ))}
                {/* Current time indicator */}
                {isToday(day) && currentTimeTop > 0 && currentTimeTop < HOURS.length * HOUR_HEIGHT && (
                  <div
                    ref={dayIdx === todayColIndex ? currentTimeRef : undefined}
                    className="absolute left-0 right-0 z-10 pointer-events-none"
                    style={{ top: currentTimeTop }}
                  >
                    <div className="flex items-center">
                      <div className="h-2.5 w-2.5 rounded-full bg-red-400 -ml-1 shrink-0" />
                      <div className="h-px flex-1 bg-red-400/80" />
                    </div>
                  </div>
                )}
                {/* Event blocks */}
                {eventsForDay(day)
                  .filter((e) => !e.all_day)
                  .map((event) => {
                    const { top, height } = getEventPosition(event);
                    const p = getEventPalette(event);
                    return (
                      <button
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(event);
                        }}
                        className={`absolute left-0.5 right-0.5 overflow-hidden rounded border px-1.5 py-0.5 text-left transition-all hover:brightness-110 hover:shadow-lg hover:z-20 hover:-translate-y-px ${p.bg} ${p.border} ${p.text}`}
                        style={{ top, height, minHeight: 24 }}
                      >
                        <p className="truncate text-[11px] font-semibold leading-tight">{event.title}</p>
                        {height > 32 && (
                          <p className="truncate text-[10px] opacity-70">
                            {format(parseISO(event.start), "h:mm a")}
                            {event.location ? ` · ${event.location}` : ""}
                          </p>
                        )}
                        {height > 52 && event.participants && event.participants.length > 0 && (
                          <p className="truncate text-[10px] opacity-60 flex items-center gap-0.5">
                            <Users className="h-2.5 w-2.5 inline shrink-0" />
                            {event.participants
                              .slice(0, 2)
                              .map((p) => p.name || p.email.split("@")[0])
                              .join(", ")}
                          </p>
                        )}
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        // ─── MONTH VIEW ───────────────────────────────────────────────────────
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-7 border-b border-border bg-card sticky top-0 z-10">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="border-r border-border px-2 py-2 text-center last:border-r-0">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{d}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthGrid.map((day) => {
              const isCurrent = isSameMonth(day, currentDate);
              const isTodayDay = isToday(day);
              const dayEvts = eventsForDay(day);
              const shown = dayEvts.slice(0, 3);
              const overflow = dayEvts.length - 3;
              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[100px] border-b border-r border-border p-1.5 cursor-pointer hover:bg-muted/20 transition-colors last-col:border-r-0 ${!isCurrent ? "opacity-40 bg-muted/5" : ""}`}
                  onClick={() => {
                    setViewMode("week");
                    setCurrentDate(day);
                  }}
                >
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold mb-1 ${isTodayDay ? "bg-primary text-primary-foreground" : "text-foreground"}`}
                  >
                    {format(day, "d")}
                  </div>
                  <div className="space-y-0.5">
                    {shown.map((event) => {
                      const p = getEventPalette(event);
                      return (
                        <button
                          key={event.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(event);
                          }}
                          className={`flex w-full items-center gap-1 rounded px-1 py-0.5 text-left border ${p.bg} ${p.border} ${p.text} hover:brightness-110`}
                        >
                          <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${p.dot}`} />
                          <span className="text-[10px] font-medium truncate">{event.title}</span>
                        </button>
                      );
                    })}
                    {overflow > 0 && (
                      <p className="text-[10px] text-muted-foreground pl-1 font-medium">+{overflow} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Event Detail Modal ── */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`h-1.5 w-full ${getEventPalette(selectedEvent).dot}`} />
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0 pr-3">
                  <h3 className="text-lg font-semibold text-foreground">{selectedEvent.title}</h3>
                  {(() => {
                    const acc = accounts.find((a) => a.id === (selectedEvent as any)._account_id);
                    const p = getEventPalette(selectedEvent);
                    return acc ? (
                      <div
                        className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${p.pill}`}
                      >
                        <Mail className="h-2.5 w-2.5" /> {acc.email}
                      </div>
                    ) : null;
                  })()}
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setSelectedEvent(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <CalendarIcon className="h-4 w-4 shrink-0 text-primary/60" />
                  {selectedEvent.all_day ? (
                    <span>{format(parseISO(selectedEvent.start), "EEEE, MMMM d")} · All Day</span>
                  ) : (
                    <span>
                      {format(parseISO(selectedEvent.start), "EEEE, MMMM d")} ·{" "}
                      <span className="text-foreground font-medium">
                        {format(parseISO(selectedEvent.start), "h:mm a")} –{" "}
                        {format(parseISO(selectedEvent.end), "h:mm a")}
                      </span>
                      <span className="ml-1 text-xs opacity-60">
                        ({differenceInMinutes(parseISO(selectedEvent.end), parseISO(selectedEvent.start))} min)
                      </span>
                    </span>
                  )}
                </div>
                {selectedEvent.location && (
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0 text-primary/60" />
                    <a
                      href={`https://maps.google.com?q=${encodeURIComponent(selectedEvent.location)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-primary transition-colors"
                    >
                      {selectedEvent.location}
                    </a>
                  </div>
                )}
                {selectedEvent.organizer && (
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <Clock className="h-4 w-4 shrink-0 text-primary/60" />
                    <span>
                      By{" "}
                      <span className="text-foreground">
                        {selectedEvent.organizer.name || selectedEvent.organizer.email}
                      </span>
                    </span>
                  </div>
                )}
                {selectedEvent.participants && selectedEvent.participants.length > 0 && (
                  <div className="flex items-start gap-2.5 text-muted-foreground">
                    <Users className="h-4 w-4 shrink-0 mt-0.5 text-primary/60" />
                    <div className="flex flex-wrap gap-1">
                      {selectedEvent.participants.map((p, i) => (
                        <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
                          {p.name || p.email}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedEvent.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-3">
                    {selectedEvent.description}
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  {selectedEvent.html_link && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5 text-xs"
                      onClick={() => window.open(selectedEvent.html_link, "_blank")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Open in Google Calendar
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    onClick={() => setSelectedEvent(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Event Modal ── */}
      <CreateEventModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSave={handleCreateEvent}
        initialDate={createInitialDate}
        initialHour={createInitialHour}
        accounts={accounts}
        defaultAccountId={selectedAccountIds.has("all") ? accounts[0]?.id : [...selectedAccountIds][0]}
      />
    </div>
  );
}
