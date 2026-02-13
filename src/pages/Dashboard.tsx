import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { awsApi } from "@/lib/awsApi";
import { useAlertPreferences } from "@/hooks/useAlertPreferences";
import { getOrAnalyze } from "@/services/aiAnalysis";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Email,
  EmailAnalysis,
  CATEGORY_COLORS,
  URGENCY_DOT_COLORS,
  getUrgencyLevel,
} from "@/components/inbox/types";
import {
  Mail,
  MailOpen,
  AlertTriangle,
  MessageSquareWarning,
  RefreshCw,
  Brain,
  Inbox,
  Loader2,
} from "lucide-react";
import {
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  format,
} from "date-fns";

function formatRelativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMins = differenceInMinutes(now, date);
  if (diffMins < 60) return `${Math.max(diffMins, 0)}m ago`;
  const diffHrs = differenceInHours(now, date);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (differenceInDays(now, date) < 7) return format(date, "EEE");
  return format(date, "MMM d");
}

interface StatsCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  accent?: string;
}

function StatsCard({ icon, label, value, accent }: StatsCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-colors">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${accent ?? "bg-primary/10 text-primary"}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        {value === null ? (
          <Skeleton className="mt-1 h-7 w-16" />
        ) : (
          <p className="text-2xl font-bold text-foreground">{value}</p>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { prefs: alertPrefs } = useAlertPreferences();
  const toastQueueRef = useRef<string[]>([]);

  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [recentEmails, setRecentEmails] = useState<Email[] | null>(null);
  const [analysesMap, setAnalysesMap] = useState<Record<string, EmailAnalysis> | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [remainingUnanalyzed, setRemainingUnanalyzed] = useState<number>(0);

  const notifyUrgentEmails = useCallback(
    (newEntries: Record<string, EmailAnalysis>, emailsLookup: Email[]) => {
      const emailMap = new Map(emailsLookup.map((e) => [e.id, e]));
      let shown = 0;
      const MAX_TOASTS = 5;

      for (const [emailId, analysis] of Object.entries(newEntries)) {
        if (shown >= MAX_TOASTS) break;
        if (toastQueueRef.current.includes(emailId)) continue;

        const email = emailMap.get(emailId);
        if (!email) continue;

        const hasLegalThreat = analysis.risk_flags?.includes("legal_threat");
        const isCritical = analysis.urgency >= 5 || hasLegalThreat;
        const isHigh = analysis.urgency >= alertPrefs.urgencyThreshold;
        const hasRiskFlags = (analysis.risk_flags?.length ?? 0) > 0;

        if (isCritical && (alertPrefs.showUrgentToasts || alertPrefs.showRiskFlagToasts)) {
          const flagDesc = analysis.risk_flags?.[0]?.replace(/_/g, " ") ?? "critical";
          toast({
            title: `⚠️ URGENT: ${email.subject}`,
            description: flagDesc,
            variant: "destructive",
            duration: 8000,
          });
          toastQueueRef.current.push(emailId);
          shown++;
        } else if (isHigh && alertPrefs.showUrgentToasts) {
          toast({
            title: `🔔 High Priority: ${email.subject}`,
            duration: 8000,
          });
          toastQueueRef.current.push(emailId);
          shown++;
        } else if (hasRiskFlags && alertPrefs.showRiskFlagToasts) {
          const flagDesc = analysis.risk_flags?.[0]?.replace(/_/g, " ") ?? "risk detected";
          toast({
            title: `🔔 ${email.subject}`,
            description: flagDesc,
            duration: 8000,
          });
          toastQueueRef.current.push(emailId);
          shown++;
        }
      }
    },
    [alertPrefs, toast]
  );

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    const [totalRes, unreadRes, recentRes, analysesRes] = await Promise.allSettled([
      awsApi.getEmails(user.id, 1, 1, "inbox"),
      awsApi.getEmails(user.id, 1, 1, "unread"),
      awsApi.getEmails(user.id, 1, 5, "unread"),
      awsApi.getAllAnalyses(user.id),
    ]);

    if (totalRes.status === "fulfilled") setTotalCount(totalRes.value.total ?? 0);
    if (unreadRes.status === "fulfilled") setUnreadCount(unreadRes.value.total ?? 0);
    if (recentRes.status === "fulfilled") setRecentEmails(recentRes.value.emails ?? []);
    if (analysesRes.status === "fulfilled") {
      const raw = analysesRes.value;
      if (Array.isArray(raw)) {
        const map: Record<string, EmailAnalysis> = {};
        for (const a of raw) {
          if (a.email_id) map[a.email_id] = a;
        }
        setAnalysesMap(map);
      } else if (raw && typeof raw === "object") {
        setAnalysesMap(raw as Record<string, EmailAnalysis>);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-analyze on first load if there are unanalyzed emails
  useEffect(() => {
    if (recentEmails === null || analysesMap === null) return;
    
    const data = async () => {
      if (!user?.id) return;
      const allEmails = await awsApi.getEmails(user.id, 1, 100, "inbox");
      const emails: Email[] = allEmails.emails ?? [];
      const unanalyzedCount = emails.filter(e => !analysesMap[e.id]).length;
      
      if (unanalyzedCount > 0) {
        autoAnalyze(20);
      }
    };
    
    data();
  }, []);

  const requiresResponseCount = useMemo(() => {
    if (!analysesMap) return null;
    return Object.values(analysesMap).filter((a) => a.requires_response).length;
  }, [analysesMap]);

  const highUrgencyCount = useMemo(() => {
    if (!analysesMap) return null;
    return Object.values(analysesMap).filter((a) => a.urgency >= 4).length;
  }, [analysesMap]);

  const categoryCounts = useMemo(() => {
    if (!analysesMap) return null;
    const counts: Record<string, number> = {};
    for (const a of Object.values(analysesMap)) {
      counts[a.category] = (counts[a.category] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1]);
  }, [analysesMap]);

  const maxCategoryCount = useMemo(() => {
    if (!categoryCounts) return 1;
    return Math.max(...categoryCounts.map(([, c]) => c), 1);
  }, [categoryCounts]);

  const autoAnalyze = useCallback(async (cap?: number) => {
    if (!user?.id || batchAnalyzing) return;
    setBatchAnalyzing(true);
    try {
      const data = await awsApi.getEmails(user.id, 1, 100, "inbox");
      const emails: Email[] = data.emails ?? [];
      const existing = analysesMap ?? {};
      const unanalyzed = emails.filter((e) => !existing[e.id]);
      
      if (unanalyzed.length === 0) {
        setBatchAnalyzing(false);
        setRemainingUnanalyzed(0);
        return;
      }

      const toAnalyze = cap ? unanalyzed.slice(0, cap) : unanalyzed;
      const remaining = Math.max(0, unanalyzed.length - (cap ?? unanalyzed.length));
      setRemainingUnanalyzed(remaining);

      setBatchProgress({ done: 0, total: toAnalyze.length });
      const batchSize = 3;
      const delayMs = 500;

      for (let i = 0; i < toAnalyze.length; i += batchSize) {
        if (i > 0) await new Promise(resolve => setTimeout(resolve, delayMs));
        
        const batch = toAnalyze.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map((email) =>
            getOrAnalyze(email.id, {
              id: email.id,
              from_name: email.from_name,
              from_address: email.from_address,
              subject: email.subject,
              snippet: email.snippet,
              user_id: user.id,
            })
          )
        );
        
        const newEntries: Record<string, EmailAnalysis> = {};
        results.forEach((r, idx) => {
          if (r.status === "fulfilled") newEntries[batch[idx].id] = r.value;
        });
        notifyUrgentEmails(newEntries, toAnalyze);
        setAnalysesMap((prev) => ({ ...(prev ?? {}), ...newEntries }));
        setBatchProgress((prev) => ({ ...prev, done: Math.min(i + batchSize, toAnalyze.length) }));
      }

      toast({ title: `Analyzed ${toAnalyze.length} email${toAnalyze.length !== 1 ? "s" : ""}` });
      fetchData();
    } catch {
      toast({ title: "Analysis failed", variant: "destructive" });
    } finally {
      setBatchAnalyzing(false);
    }
  }, [user?.id, batchAnalyzing, analysesMap]);

  const handleSync = async () => {
    if (!user?.id) return;
    setSyncing(true);
    try {
      const res = await awsApi.syncEmails(user.id);
      const count = res?.new_emails ?? res?.synced ?? 0;
      toast({ title: `Synced ${count} email${count !== 1 ? "s" : ""}` });
      fetchData();
      // Auto-analyze new emails after sync
      await new Promise(resolve => setTimeout(resolve, 500));
      autoAnalyze();
    } catch {
      toast({ title: "Sync failed", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleReanalyzeAll = async () => {
    if (!user?.id || batchAnalyzing) return;
    setBatchAnalyzing(true);
    try {
      const data = await awsApi.getEmails(user.id, 1, 100, "inbox");
      const emails: Email[] = data.emails ?? [];
      
      setBatchProgress({ done: 0, total: emails.length });
      const batchSize = 3;
      const delayMs = 500;

      for (let i = 0; i < emails.length; i += batchSize) {
        if (i > 0) await new Promise(resolve => setTimeout(resolve, delayMs));
        
        const batch = emails.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map((email) =>
            getOrAnalyze(email.id, {
              id: email.id,
              from_name: email.from_name,
              from_address: email.from_address,
              subject: email.subject,
              snippet: email.snippet,
              user_id: user.id,
            }, true) // forceRefresh=true to skip cache
          )
        );
        
        const newEntries: Record<string, EmailAnalysis> = {};
        results.forEach((r, idx) => {
          if (r.status === "fulfilled") newEntries[batch[idx].id] = r.value;
        });
        notifyUrgentEmails(newEntries, emails);
        setAnalysesMap((prev) => ({ ...(prev ?? {}), ...newEntries }));
        setBatchProgress((prev) => ({ ...prev, done: Math.min(i + batchSize, emails.length) }));
      }

      toast({ title: `Re-analyzed ${emails.length} email${emails.length !== 1 ? "s" : ""}` });
      fetchData();
    } catch {
      toast({ title: "Re-analysis failed", variant: "destructive" });
    } finally {
      setBatchAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome back, {user?.user_metadata?.full_name || "there"}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          icon={<Mail className="h-5 w-5" />}
          label="Total Emails"
          value={totalCount}
        />
        <StatsCard
          icon={<MailOpen className="h-5 w-5" />}
          label="Unread"
          value={unreadCount}
          accent="bg-blue-500/10 text-blue-400"
        />
        <StatsCard
          icon={<MessageSquareWarning className="h-5 w-5" />}
          label="Needs Response"
          value={requiresResponseCount}
          accent="bg-yellow-500/10 text-yellow-400"
        />
        <StatsCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="High Urgency"
          value={highUrgencyCount}
          accent="bg-red-500/10 text-red-400"
        />
      </div>

      {/* Main content row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Emails - spans 2 cols */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">Recent Unread</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/inbox")} className="text-xs text-muted-foreground">
              View all
            </Button>
          </div>
          <div className="divide-y divide-border">
            {recentEmails === null ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                  <Skeleton className="h-2 w-2 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                  <Skeleton className="h-3 w-12" />
                </div>
              ))
            ) : recentEmails.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <p className="text-sm text-muted-foreground">No unread emails ✨</p>
              </div>
            ) : (
              recentEmails.map((email) => {
                const analysis = analysesMap?.[email.id];
                const urgencyLevel = analysis ? getUrgencyLevel(analysis.urgency) : null;
                const urgencyDotClass = urgencyLevel ? URGENCY_DOT_COLORS[urgencyLevel] : null;
                const catClass = analysis
                  ? CATEGORY_COLORS[analysis.category] ?? CATEGORY_COLORS.general
                  : null;

                return (
                  <button
                    key={email.id}
                    onClick={() => navigate("/inbox")}
                    className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/30"
                  >
                    <div className="flex w-2.5 shrink-0 items-center justify-center">
                      {urgencyDotClass ? (
                        <div className={`h-2 w-2 rounded-full ${urgencyDotClass}`} />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/20" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {email.from_name || email.from_address}
                        </span>
                        {catClass && (
                          <span className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-0 text-[10px] font-medium leading-4 ${catClass}`}>
                            {analysis!.category}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-sm text-muted-foreground mt-0.5">
                        {email.subject}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeDate(email.received_at)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Category Breakdown */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">Categories</h2>
            </div>
            <div className="px-5 py-4 space-y-3">
              {categoryCounts === null ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                ))
              ) : categoryCounts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No analysis data yet. Run Analyze All.</p>
              ) : (
                categoryCounts.map(([category, count]) => {
                  const colors = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.general;
                  const barColor = getCategoryBarColor(category);
                  return (
                    <div key={category}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-3 ${colors}`}>
                          {category}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">{count}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all ${barColor}`}
                          style={{ width: `${(count / maxCategoryCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">Quick Actions</h2>
            </div>
            <div className="flex flex-col gap-2 p-4">
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={handleSync}
                disabled={syncing}
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing..." : "Sync Emails"}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={handleReanalyzeAll}
                disabled={batchAnalyzing}
              >
                {batchAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing {batchProgress.done}/{batchProgress.total}
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4" />
                    Re-analyze All Emails
                  </>
                )}
              </Button>
              {remainingUnanalyzed > 0 && !batchAnalyzing && (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => autoAnalyze()}
                >
                  <Brain className="h-4 w-4" />
                  Analyze Remaining {remainingUnanalyzed} Emails
                </Button>
              )}
              <Button
                className="w-full justify-start gap-2"
                onClick={() => navigate("/inbox")}
              >
                <Inbox className="h-4 w-4" />
                Go to Inbox
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getCategoryBarColor(category: string): string {
  const map: Record<string, string> = {
    client: "bg-blue-500",
    billing: "bg-emerald-500",
    legal: "bg-red-500",
    insurance: "bg-orange-500",
    vendor: "bg-purple-500",
    scheduling: "bg-yellow-500",
    marketing: "bg-pink-500",
    personal: "bg-muted-foreground/40",
    internal: "bg-muted-foreground/40",
    general: "bg-muted-foreground/40",
  };
  return map[category] ?? "bg-muted-foreground/40";
}
