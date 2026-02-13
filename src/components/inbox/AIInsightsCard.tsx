import { Loader2, AlertTriangle, MessageSquareQuote, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EmailAnalysis,
  CATEGORY_COLORS,
  SENTIMENT_COLORS,
  getUrgencyLevel,
} from "./types";

interface AIInsightsCardProps {
  analysis: EmailAnalysis | null;
  loading: boolean;
  error: string | null;
}

function UrgencyDots({ urgency }: { urgency: number }) {
  const level = getUrgencyLevel(urgency);
  const fillColor =
    level === "low" ? "bg-emerald-500" : level === "medium" ? "bg-yellow-500" : "bg-red-500";
  const emptyColor = "bg-muted-foreground/20";

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`h-2 w-2 rounded-full ${i < urgency ? fillColor : emptyColor}`}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{urgency}/5</span>
    </div>
  );
}

function formatRiskFlag(flag: string): string {
  return flag
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AIInsightsCard({ analysis, loading, error }: AIInsightsCardProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-4">
        <Brain className="h-4 w-4 animate-pulse text-primary" />
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Analyzing with AI...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <span className="text-sm text-destructive">{error}</span>
      </div>
    );
  }

  if (!analysis) return null;

  const catClass = CATEGORY_COLORS[analysis.category] ?? CATEGORY_COLORS.general;
  const sentClass = SENTIMENT_COLORS[analysis.sentiment] ?? SENTIMENT_COLORS.neutral;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">AI Insights</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {Math.round(analysis.confidence * 100)}% confidence
        </span>
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${catClass}`}>
          {analysis.category}
        </span>
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${sentClass}`}>
          {analysis.sentiment}
        </span>
        {analysis.requires_response && (
          <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400">
            Requires Response
          </span>
        )}
      </div>

      {/* Urgency */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Urgency:</span>
        <UrgencyDots urgency={analysis.urgency} />
      </div>

      {/* Risk flags */}
      {analysis.risk_flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {analysis.risk_flags.map((flag) => (
            <span
              key={flag}
              className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400"
            >
              <AlertTriangle className="h-3 w-3" />
              {formatRiskFlag(flag)}
            </span>
          ))}
        </div>
      )}

      {/* Summary */}
      <p className="text-sm italic text-foreground/80">{analysis.summary}</p>

      {/* Suggested reply */}
      {analysis.suggested_reply && (
        <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3">
          <div className="flex items-start gap-2">
            <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-xs font-medium text-blue-400">Suggested Reply</p>
              <p className="text-sm text-foreground/80">{analysis.suggested_reply}</p>
              <Button variant="outline" size="sm" className="mt-2 text-xs" disabled>
                Use as Draft
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
