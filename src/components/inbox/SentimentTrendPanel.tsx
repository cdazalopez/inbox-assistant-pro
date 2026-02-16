import { useMemo } from "react";
import { Email, EmailAnalysis } from "@/components/inbox/types";
import {
  analyzeThreadSentiment,
  getSentimentBarColor,
  getSentimentEmoji,
  SentimentTrend,
} from "@/services/sentimentTrendService";
import { normalizeSubject } from "@/services/threadSummaryService";
import { TrendingUp, TrendingDown, ArrowRight, AlertTriangle } from "lucide-react";

interface SentimentTrendPanelProps {
  selectedEmail: Email;
  allEmails: Email[];
  analysesMap: Record<string, EmailAnalysis>;
}

function TrendIcon({ direction }: { direction: SentimentTrend["direction"] }) {
  switch (direction) {
    case "improving":
      return (
        <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-medium">
          <TrendingUp className="h-3.5 w-3.5" /> Improving
        </span>
      );
    case "escalating":
      return (
        <span className="inline-flex items-center gap-1 text-red-400 text-xs font-medium">
          <TrendingDown className="h-3.5 w-3.5" /> Escalating
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-muted-foreground text-xs font-medium">
          <ArrowRight className="h-3.5 w-3.5" /> Stable
        </span>
      );
  }
}

export default function SentimentTrendPanel({
  selectedEmail,
  allEmails,
  analysesMap,
}: SentimentTrendPanelProps) {
  const trend = useMemo(() => {
    return analyzeThreadSentiment(allEmails, analysesMap);
  }, [allEmails, analysesMap]);

  if (!trend) return null;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Sentiment Trend</span>
        </div>
        <TrendIcon direction={trend.direction} />
      </div>

      {/* Escalation warning */}
      {trend.isEscalating && (
        <div className="flex items-start gap-2 rounded-md border border-orange-500/30 bg-orange-500/10 p-3">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-orange-400" />
          <p className="text-xs text-orange-300">
            ⚠️ This conversation's tone has shifted from{" "}
            <strong>{trend.previousSentiment}</strong> to{" "}
            <strong>{trend.currentSentiment}</strong> over {trend.messageCount} messages.
            Consider a careful response.
          </p>
        </div>
      )}

      {/* Sentiment bar visualization */}
      <div className="flex items-end gap-1 h-8">
        {trend.points.map((point, i) => {
          const barColor = getSentimentBarColor(point.sentiment);
          const height =
            point.sentiment === "positive"
              ? "h-8"
              : point.sentiment === "neutral"
              ? "h-5"
              : point.sentiment === "mixed"
              ? "h-3"
              : "h-2";

          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center gap-1"
              title={`${point.from}: ${point.sentiment}`}
            >
              <div className={`w-full rounded-sm ${barColor} ${height} transition-all`} />
            </div>
          );
        })}
      </div>

      {/* Legend labels */}
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{trend.points[0]?.from?.split(" ")[0]}</span>
        <span>{trend.points[trend.points.length - 1]?.from?.split(" ")[0]}</span>
      </div>

      {/* Per-message sentiment list */}
      <div className="space-y-1">
        {trend.points.map((point, i) => {
          const { emoji, color } = getSentimentEmoji(point.sentiment);
          return (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className={`${color} text-sm`}>{emoji}</span>
              <span className="text-muted-foreground truncate">{point.from}</span>
              <span className={`ml-auto font-medium ${color}`}>{point.sentiment}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
