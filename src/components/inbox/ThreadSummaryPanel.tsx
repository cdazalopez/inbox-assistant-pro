import { useState, useCallback } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Email } from "@/components/inbox/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  ThreadSummary,
  CachedThreadSummary,
  getCachedSummary,
  cacheSummary,
  clearCachedSummary,
  normalizeSubject,
} from "@/services/threadSummaryService";
import {
  Sparkles,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  ChevronDown,
  ChevronUp,
  Users,
} from "lucide-react";

interface ThreadSummaryPanelProps {
  selectedEmail: Email;
  allEmails: Email[];
}

export default function ThreadSummaryPanel({ selectedEmail, allEmails }: ThreadSummaryPanelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [cached, setCached] = useState<CachedThreadSummary | null>(() => {
    const key = normalizeSubject(selectedEmail.subject);
    return getCachedSummary(key);
  });
  const [expanded, setExpanded] = useState(true);

  const threadKey = normalizeSubject(selectedEmail.subject);

  // Find thread emails
  const threadEmails = allEmails
    .filter((e) => normalizeSubject(e.subject) === threadKey)
    .sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime());

  const isThread = threadEmails.length >= 2;

  const handleSummarize = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) clearCachedSummary(threadKey);

    const existing = forceRefresh ? null : getCachedSummary(threadKey);
    if (existing) {
      setCached(existing);
      return;
    }

    setLoading(true);
    try {
      const emailsPayload = threadEmails.map((e) => ({
        from_name: e.from_name,
        from_address: e.from_address,
        subject: e.subject,
        snippet: e.snippet,
        received_at: e.received_at,
      }));

      const { data, error } = await supabase.functions.invoke("summarize-thread", {
        body: { emails: emailsPayload },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const summary = data as ThreadSummary;
      const c = cacheSummary(threadKey, summary);
      setCached(c);
      toast({ title: "Thread summarized" });
    } catch (e) {
      toast({
        title: "Failed to summarize thread",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [threadKey, threadEmails, toast]);

  if (!isThread) return null;

  const summary = cached?.summary;

  return (
    <div className="space-y-3">
      {/* Summarize button */}
      {!summary && !loading && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleSummarize()}
          className="gap-2"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Summarize Thread ({threadEmails.length} messages)
        </Button>
      )}

      {loading && (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Summarizing {threadEmails.length} messages...
          </div>
          <div className="mt-3 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      )}

      {summary && (
        <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
          {/* Header */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/30"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Thread Summary</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {threadEmails.length} msgs
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSummarize(true);
                }}
                title="Refresh summary"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </button>

          {expanded && (
            <div className="space-y-4 border-t border-border px-4 py-4">
              {/* Timeline */}
              {summary.timeline.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    Timeline
                  </div>
                  <div className="relative ml-2 border-l-2 border-border pl-4 space-y-3">
                    {summary.timeline.map((item, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background" />
                        <p className="text-xs text-muted-foreground">{item.date} · {item.from}</p>
                        <p className="text-sm text-foreground">{item.action}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Decisions */}
              {summary.decisions.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    Decisions Made
                  </div>
                  <ul className="space-y-1 pl-1">
                    {summary.decisions.map((d, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-400" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Pending */}
              {summary.pending.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider">
                    <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
                    Still Pending
                  </div>
                  <ul className="space-y-1 pl-1">
                    {summary.pending.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-orange-400" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Key Points */}
              {summary.key_points.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider">
                    <Info className="h-3.5 w-3.5 text-blue-400" />
                    Key Takeaways
                  </div>
                  <ul className="space-y-1 pl-1">
                    {summary.key_points.map((k, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-400" />
                        {k}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Participants */}
              {summary.participants.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    Participants
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {summary.participants.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-full border border-border bg-muted/30 px-3 py-1"
                      >
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-[10px] font-semibold text-primary">
                          {p.name[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div className="text-xs">
                          <span className="font-medium text-foreground">{p.name}</span>
                          <span className="text-muted-foreground ml-1">({p.message_count})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Last summarized */}
              {cached?.generated_at && (
                <p className="text-[10px] text-muted-foreground">
                  Last summarized: {formatDistanceToNow(new Date(cached.generated_at), { addSuffix: true })}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
