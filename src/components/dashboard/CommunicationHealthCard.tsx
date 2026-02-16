import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Email, EmailAnalysis } from "@/components/inbox/types";
import { getEscalatingThreads, getNegativeSentimentCount } from "@/services/sentimentTrendService";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle, CheckCircle2, TrendingDown } from "lucide-react";

interface CommunicationHealthCardProps {
  emails: Email[];
  analysesMap: Record<string, EmailAnalysis> | null;
}

export default function CommunicationHealthCard({ emails, analysesMap }: CommunicationHealthCardProps) {
  const navigate = useNavigate();

  const escalatingThreads = useMemo(() => {
    if (!analysesMap || emails.length === 0) return [];
    return getEscalatingThreads(emails, analysesMap);
  }, [emails, analysesMap]);

  const negativeCount = useMemo(() => {
    if (!analysesMap) return 0;
    return getNegativeSentimentCount(analysesMap);
  }, [analysesMap]);

  const hasIssues = escalatingThreads.length > 0 || negativeCount > 0;

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <Shield className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Communication Health</h2>
      </div>
      <div className="px-5 py-4 space-y-3">
        {!hasIssues ? (
          <div className="flex items-center gap-3 py-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">All Clear</p>
              <p className="text-xs text-muted-foreground">No escalations detected</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {escalatingThreads.length > 0 && (
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                  <TrendingDown className="h-4 w-4 text-red-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-red-400">
                    {escalatingThreads.length} Escalating Thread{escalatingThreads.length !== 1 ? "s" : ""}
                  </p>
                  {escalatingThreads.slice(0, 3).map((t, i) => (
                    <p key={i} className="text-xs text-muted-foreground truncate">
                      {t.threadSubject}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {negativeCount > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500/10">
                  <AlertTriangle className="h-4 w-4 text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-orange-400">
                    {negativeCount} Negative Email{negativeCount !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">Requires attention</p>
                </div>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => navigate("/inbox")}
            >
              View in Inbox
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
