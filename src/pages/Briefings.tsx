import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { awsApi } from "@/lib/awsApi";
import { generateBriefing, Briefing, BriefingContent } from "@/services/briefingService";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useVoiceBriefing } from "@/hooks/useVoiceBriefing";
import {
  FileText,
  Loader2,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Star,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronUp,
  Volume2,
  Pause,
  Square,
  Play,
} from "lucide-react";
import { format } from "date-fns";

export default function Briefings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const voice = useVoiceBriefing();
  const [todayBriefing, setTodayBriefing] = useState<Briefing | null>(null);
  const [pastBriefings, setPastBriefings] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedPast, setExpandedPast] = useState<Set<string>>(new Set());

  const today = new Date().toISOString().split("T")[0];

  const fetchBriefings = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const all: Briefing[] = (await awsApi.getBriefings(user.id)) ?? [];
      const todayItem = all.find((b) => b.date === today);
      setTodayBriefing(todayItem ?? null);
      setPastBriefings(
        all
          .filter((b) => b.date !== today)
          .sort((a, b) => b.date.localeCompare(a.date))
      );
    } catch {
      // silently fail on load
    } finally {
      setLoading(false);
    }
  }, [user?.id, today]);

  useEffect(() => {
    fetchBriefings();
  }, [fetchBriefings]);

  const handleGenerate = async () => {
    if (!user?.id) return;
    setGenerating(true);
    try {
      const briefing = await generateBriefing(user.id);
      setTodayBriefing(briefing);
      toast({ title: "Briefing generated successfully" });
      if (voice.voicePrefs.autoPlay) {
        voice.play(briefing.content, briefing.date);
      }
    } catch (e) {
      toast({
        title: "Failed to generate briefing",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedPast((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Daily Briefings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI-generated summaries of your inbox activity
        </p>
      </div>

      {/* Today's Briefing */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Today's Briefing</h2>
              <p className="text-xs text-muted-foreground">
                {format(new Date(), "EEEE, MMMM d, yyyy")}
              </p>
            </div>
          </div>
          {todayBriefing && (
            <div className="flex items-center gap-2">
              {voice.state === "idle" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => voice.play(todayBriefing.content, todayBriefing.date)}
                  className="gap-2"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  Play Briefing
                </Button>
              ) : (
                <div className="flex items-center gap-1">
                  {voice.state === "playing" ? (
                    <Button variant="outline" size="sm" onClick={voice.pause} className="gap-2">
                      <Pause className="h-3.5 w-3.5" />
                      Pause
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={voice.resume} className="gap-2">
                      <Play className="h-3.5 w-3.5" />
                      Resume
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={voice.stop}>
                    <Square className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={generating}
                className="gap-2"
              >
                {generating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Regenerate
              </Button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : todayBriefing ? (
          <BriefingDetail content={todayBriefing.content} />
        ) : (
          <div className="flex flex-col items-center gap-4 py-12 px-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">No briefing yet today</p>
              <p className="text-xs text-muted-foreground mt-1">
                Generate a briefing to get an AI summary of your inbox
              </p>
            </div>
            <Button onClick={handleGenerate} disabled={generating} className="gap-2">
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Briefing
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Past Briefings */}
      {pastBriefings.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Past Briefings</h2>
          <div className="space-y-2">
            {pastBriefings.map((b) => {
              const isExpanded = expandedPast.has(b.id);
              const content: BriefingContent =
                typeof b.content === "string" ? JSON.parse(b.content) : b.content;
              return (
                <div
                  key={b.id}
                  className="rounded-xl border border-border bg-card overflow-hidden"
                >
                  <button
                    onClick={() => toggleExpand(b.id)}
                    className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {format(new Date(b.date + "T12:00:00"), "EEEE, MMMM d, yyyy")}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {content.summary}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {b.urgent_count > 0 && (
                        <Badge
                          variant="destructive"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {b.urgent_count} urgent
                        </Badge>
                      )}
                      {b.pending_count > 0 && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {b.pending_count} pending
                        </Badge>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>
                  {isExpanded && <BriefingDetail content={content} />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function BriefingDetail({ content }: { content: BriefingContent }) {
  const navigate = useNavigate();
  const c =
    typeof content === "string" ? (JSON.parse(content) as BriefingContent) : content;

  const categoryEntries = c.stats?.categories
    ? Object.entries(c.stats.categories).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div className="space-y-5 p-6">
      {/* Summary */}
      <p className="text-sm text-foreground leading-relaxed">{c.summary}</p>

      {/* Stats bar */}
      {c.stats && (
        <div className="flex flex-wrap gap-3">
          <StatPill label="New emails" value={c.stats.total_new} />
          <StatPill
            label="Urgent"
            value={c.stats.urgent_count}
            accent={c.stats.urgent_count > 0 ? "text-red-400" : undefined}
          />
          <StatPill label="Need response" value={c.stats.requires_response_count} />
        </div>
      )}

      {/* Urgent Items */}
      {c.urgent_items?.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-red-400">
            <AlertTriangle className="h-4 w-4" />
            Urgent Items
          </div>
          <div className="space-y-1.5">
            {c.urgent_items.map((item, i) => (
              <button
                key={i}
                onClick={() => {
                  if ((item as any).email_id) {
                    navigate(`/inbox?emailId=${(item as any).email_id}`);
                  } else {
                    navigate(`/inbox?filter=urgent`);
                  }
                }}
                className="w-full rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-left transition-colors hover:bg-red-500/10 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{item.subject}</p>
                  <span className="text-muted-foreground text-[10px] shrink-0 ml-2">→</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  From: {item.from} · {item.reason}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action Items */}
      {c.action_items?.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Action Items
          </div>
          <ul className="space-y-1.5 pl-1">
            {c.action_items.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <span className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Highlights */}
      {c.highlights?.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Star className="h-4 w-4 text-yellow-400" />
            Highlights
          </div>
          <ul className="space-y-1.5 pl-1">
            {c.highlights.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <span className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Category breakdown */}
      {categoryEntries.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            Categories
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categoryEntries.map(([cat, count]) => (
              <Badge key={cat} variant="secondary" className="text-xs">
                {cat}: {count}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-3 py-1">
      <span className={`text-sm font-semibold ${accent ?? "text-foreground"}`}>
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
