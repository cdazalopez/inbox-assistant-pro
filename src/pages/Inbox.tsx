import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format, differenceInMinutes, differenceInHours, differenceInDays } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useLabels } from "@/hooks/useLabels";
import { useTemplates } from "@/hooks/useTemplates";
import { awsApi } from "@/lib/awsApi";
import { supabase } from "@/integrations/supabase/client";
import { getOrAnalyze } from "@/services/aiAnalysis";
import { generateSuggestions, SmartSuggestion } from "@/services/smartSuggestions";
import InboxSuggestionBar from "@/components/suggestions/InboxSuggestionBar";
import TaskModal from "@/components/tasks/TaskModal";
import FollowupModal from "@/components/tasks/FollowupModal";
import ComposeModal from "@/components/ComposeModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import AIInsightsCard from "@/components/inbox/AIInsightsCard";
import CategoryFilter from "@/components/inbox/CategoryFilter";
import LabelFilter from "@/components/inbox/LabelFilter";
import LabelSelector from "@/components/inbox/LabelSelector";
import LabelManager from "@/components/inbox/LabelManager";
import {
  Email,
  EmailsResponse,
  EmailAnalysis,
  CATEGORY_COLORS,
  URGENCY_DOT_COLORS,
  getUrgencyLevel,
} from "@/components/inbox/types";
import RiskFlagBadges from "@/components/alerts/RiskFlagBadges";
import UrgentBanner from "@/components/alerts/UrgentBanner";
import CalendarContext from "@/components/calendar/CalendarContext";
import ThreadSummaryPanel from "@/components/inbox/ThreadSummaryPanel";
import SentimentTrendPanel from "@/components/inbox/SentimentTrendPanel";
import { normalizeSubject } from "@/services/threadSummaryService";
import { getSentimentEmoji, analyzeThreadSentiment, getEscalatingThreads } from "@/services/sentimentTrendService";
import { isMeetingEmail } from "@/components/calendar/types";
import QuickReplyTemplates from "@/components/templates/QuickReplyTemplates";
import ContactProfilePanel from "@/components/contacts/ContactProfilePanel";
import SnoozeDropdown from "@/components/snooze/SnoozeDropdown";
import SnoozedWakeUpBanner from "@/components/snooze/SnoozedWakeUpBanner";
import SnoozedListView from "@/components/snooze/SnoozedListView";
import AccountFilterBar, { AccountIndicator } from "@/components/inbox/AccountFilterBar";
import {
  RefreshCw,
  Search,
  Star,
  Paperclip,
  Archive,
  MailOpen,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  Brain,
  PenSquare,
  Reply,
  ReplyAll,
  Forward,
  ListTodo,
  CalendarClock,
  Calendar as CalendarIcon,
  MessageSquare,
  TrendingDown,
} from "lucide-react";

function safeDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function formatRelativeDate(dateStr: string | null | undefined): string {
  const date = safeDate(dateStr);
  if (!date) return "";
  const now = new Date();
  const diffMins = differenceInMinutes(now, date);
  if (diffMins < 60) return `${Math.max(diffMins, 0)}m ago`;
  const diffHrs = differenceInHours(now, date);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (differenceInDays(now, date) < 7) return format(date, "EEE");
  return format(date, "MMM d");
}

function formatFullDate(dateStr: string | null | undefined): string {
  const date = safeDate(dateStr);
  if (!date) return "";
  return format(date, "MMMM d, yyyy 'at' h:mm a");
}

export default function Inbox() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const {
    labels,
    emailLabelsMap,
    createLabel,
    updateLabel,
    deleteLabel,
    toggleEmailLabel,
    getLabelsForEmail,
  } = useLabels();
  const { templates, trackUsage } = useTemplates();

  const [emails, setEmails] = useState<Email[]>([]);
  const [totalEmails, setTotalEmails] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const initialFilter = searchParams.get("filter") || "inbox";
  const [filter, setFilter] = useState(initialFilter);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [emailBody, setEmailBody] = useState<string | null>(null);
  const [loadingBody, setLoadingBody] = useState(false);

  // AI analysis state
  const [analysesMap, setAnalysesMap] = useState<Record<string, EmailAnalysis>>({});
  const [currentAnalysis, setCurrentAnalysis] = useState<EmailAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });

  // Compose modal state
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeReplyTo, setComposeReplyTo] = useState<any>(null);
  const [composeForwardFrom, setComposeForwardFrom] = useState<any>(null);
  const [composeInitialCc, setComposeInitialCc] = useState("");
  const [composeInitialBody, setComposeInitialBody] = useState<string | undefined>();
  const [composeEmailCategory, setComposeEmailCategory] = useState<string | undefined>();

  // Task/Followup modal state
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskInitialData, setTaskInitialData] = useState<{ title?: string; description?: string; priority?: string; email_id?: string } | undefined>();
  const [followupModalOpen, setFollowupModalOpen] = useState(false);
  const [followupEmailId, setFollowupEmailId] = useState<string | undefined>();
  const [showContactProfile, setShowContactProfile] = useState(false);

  // Snooze state
  const [dueSnoozed, setDueSnoozed] = useState<any[]>([]);
  const [aiSnoozeContext, setAiSnoozeContext] = useState<string | null>(null);
  const [loadingAiSnooze, setLoadingAiSnooze] = useState(false);

  // Multi-account state
  const [accounts, setAccounts] = useState<{ id: string; email: string; provider: string; sync_status: string }[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);

  const limit = 25;

  // Fetch all analyses for list badges
  const fetchAnalyses = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await awsApi.getAllAnalyses(user.id);
      if (Array.isArray(data)) {
        const map: Record<string, EmailAnalysis> = {};
        for (const a of data) {
          if (a.email_id) map[a.email_id] = a;
        }
        setAnalysesMap(map);
      } else if (data && typeof data === "object") {
        setAnalysesMap(data as Record<string, EmailAnalysis>);
      }
    } catch {
      // silently fail — badges are optional
    }
  }, [user?.id]);

  // AbortController ref for cancelling in-flight email fetches
  const abortRef = useRef<AbortController | null>(null);

  const fetchEmails = useCallback(
    async (p = page, f = filter, s = search) => {
      if (!user?.id) return;
      // Cancel any in-flight request
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setFetchError(null);
      try {
        const data: EmailsResponse = await awsApi.getEmails(
          user.id, p, limit, f, s,
          undefined,
          selectedAccountIds.length > 0 ? selectedAccountIds : undefined
        );
        if (controller.signal.aborted) return;
        setEmails(data.emails ?? []);
        setTotalEmails(data.total ?? 0);
        setTotalPages(data.total_pages ?? 1);
      } catch (err: any) {
        if (controller.signal.aborted) return;
        const msg = err?.message || "Failed to load emails";
        setFetchError(msg);
        toast({ title: msg, variant: "destructive" });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [user?.id, page, filter, search, selectedAccountIds, toast]
  );

  const syncAndLoad = useCallback(async () => {
    if (!user?.id) return;
    setSyncing(true);
    try {
      const syncResult = await awsApi.syncEmails(user.id);
      if (accounts.length > 1) {
        const results = syncResult?.results ?? [];
        const parts = results.map((r: any) => `${r.new_emails ?? 0} from ${r.provider ?? 'account'}`);
        toast({ title: `Synced ${accounts.length} accounts: ${parts.join(', ')}` });
      } else {
        const newCount = syncResult?.new_emails ?? syncResult?.synced ?? 0;
        toast({ title: `Synced ${newCount} new email${newCount !== 1 ? "s" : ""}` });
      }
    } catch {
      toast({ title: "Sync failed", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
    fetchEmails(1, filter, search);
    fetchAnalyses();
  }, [user?.id, accounts, filter, search, fetchEmails, fetchAnalyses, toast]);

  // Fetch due snoozed emails
  const fetchDueSnoozed = useCallback(async () => {
    if (!user?.id) return;
    try {
      const due = await awsApi.getDueSnoozed(user.id);
      setDueSnoozed(Array.isArray(due) ? due : []);
    } catch {
      // silently fail
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      syncAndLoad();
      fetchDueSnoozed();
      // Fetch accounts for multi-account filter
      awsApi.getAccounts(user.id).then((data) => {
        const accs = data?.accounts ?? data;
        if (Array.isArray(accs)) setAccounts(accs);
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (user?.id && !syncing) {
      // Clear stale emails immediately when account selection changes
      setEmails([]);
      fetchEmails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filter, search, selectedAccountIds]);

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const handleStar = async (e: React.MouseEvent, email: Email) => {
    e.stopPropagation();
    try {
      await awsApi.updateEmail(email.id, email.is_starred ? "unstar" : "star");
      setEmails((prev) =>
        prev.map((em) => (em.id === email.id ? { ...em, is_starred: !em.is_starred } : em))
      );
      if (selectedEmail?.id === email.id)
        setSelectedEmail((prev) => prev && { ...prev, is_starred: !prev.is_starred });
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
    }
  };

  const handleArchive = async (email: Email) => {
    try {
      await awsApi.updateEmail(email.id, "archive");
      setEmails((prev) => prev.filter((em) => em.id !== email.id));
      if (selectedEmail?.id === email.id) setSelectedEmail(null);
      toast({ title: "Email archived" });
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
    }
  };

  const handleMarkUnread = async (email: Email) => {
    try {
      await awsApi.updateEmail(email.id, "mark_unread");
      setEmails((prev) =>
        prev.map((em) => (em.id === email.id ? { ...em, is_read: false } : em))
      );
      if (selectedEmail?.id === email.id)
        setSelectedEmail((prev) => prev && { ...prev, is_read: false });
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
    }
  };

  const handleSelectEmail = async (email: Email) => {
    setSelectedEmail(email);
    setEmailBody(null);
    setLoadingBody(true);
    setCurrentAnalysis(null);
    setAnalysisLoading(true);
    setAnalysisError(null);

    if (!email.is_read) {
      awsApi.updateEmail(email.id, "mark_read").catch(() => {});
      setEmails((prev) =>
        prev.map((em) => (em.id === email.id ? { ...em, is_read: true } : em))
      );
    }

    // Fetch body and analysis in parallel
    const bodyPromise = awsApi.getEmail(email.id).then((data) => {
      setEmailBody(data.body ?? data.html_body ?? null);
    }).catch(() => setEmailBody(null)).finally(() => setLoadingBody(false));

    const analysisPromise = getOrAnalyze(email.id, {
      id: email.id,
      from_name: email.from_name,
      from_address: email.from_address,
      subject: email.subject,
      snippet: email.snippet,
      user_id: user?.id ?? "",
    }).then((result) => {
      setCurrentAnalysis(result);
      // Update the analyses map so the list badge shows immediately
      setAnalysesMap((prev) => ({ ...prev, [email.id]: result }));
    }).catch((err) => {
      setAnalysisError(err?.message ?? "Analysis failed");
    }).finally(() => setAnalysisLoading(false));

    await Promise.all([bodyPromise, analysisPromise]);

    // Fetch AI snooze context in background
    fetchAiSnoozeContext(email);
  };

  // Filter emails by category and label
  const filteredEmails = useMemo(() => {
    let result = emails;
    if (categoryFilter) {
      result = result.filter((e) => analysesMap[e.id]?.category === categoryFilter);
    }
    if (labelFilter) {
      result = result.filter((e) => (emailLabelsMap[e.id] ?? []).includes(labelFilter));
    }
    return result;
  }, [emails, categoryFilter, labelFilter, analysesMap, emailLabelsMap]);

  const handleBatchAnalyze = useCallback(async () => {
    if (!user?.id || batchAnalyzing) return;
    const unanalyzed = emails.filter((e) => !analysesMap[e.id]);
    if (unanalyzed.length === 0) {
      toast({ title: "All visible emails already analyzed" });
      return;
    }
    setBatchAnalyzing(true);
    setBatchProgress({ done: 0, total: unanalyzed.length });

    // Process in small batches of 3 to avoid rate limits
    const batchSize = 3;
    for (let i = 0; i < unanalyzed.length; i += batchSize) {
      const batch = unanalyzed.slice(i, i + batchSize);
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
      // Update map with successful results
      const newEntries: Record<string, EmailAnalysis> = {};
      results.forEach((r, idx) => {
        if (r.status === "fulfilled") {
          newEntries[batch[idx].id] = r.value;
        }
      });
      setAnalysesMap((prev) => ({ ...prev, ...newEntries }));
      setBatchProgress((prev) => ({ ...prev, done: Math.min(i + batchSize, unanalyzed.length) }));
    }

    setBatchAnalyzing(false);
    toast({ title: `Analyzed ${unanalyzed.length} email${unanalyzed.length !== 1 ? "s" : ""}` });
  }, [user?.id, emails, analysesMap, batchAnalyzing, toast]);

  const unreadEmailIds = useMemo(
    () => new Set(emails.filter((e) => !e.is_read).map((e) => e.id)),
    [emails]
  );

  // Thread counts for badges
  const threadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of emails) {
      const key = normalizeSubject(e.subject);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [emails]);

  // Escalating thread keys
  const escalatingKeys = useMemo(() => {
    if (Object.keys(analysesMap).length === 0) return new Set<string>();
    const escalating = getEscalatingThreads(emails, analysesMap);
    return new Set(escalating.map((t) => normalizeSubject(t.threadSubject)));
  }, [emails, analysesMap]);

  const inboxSuggestions = useMemo(() => {
    if (emails.length === 0 || Object.keys(analysesMap).length === 0) return [];
    return generateSuggestions({ emails, analysesMap, unreadIds: unreadEmailIds });
  }, [emails, analysesMap, unreadEmailIds]);

  const handleSuggestionAction = useCallback((s: SmartSuggestion) => {
    if (s.type === "bulk_archive" && s.action === "archive") {
      // Archive all emails in the suggestion
      Promise.all(s.emailIds.map((id) => awsApi.updateEmail(id, "archive")))
        .then(() => {
          setEmails((prev) => prev.filter((e) => !s.emailIds.includes(e.id)));
          toast({ title: `Archived ${s.emailIds.length} emails` });
        })
        .catch(() => toast({ title: "Archive failed", variant: "destructive" }));
    } else if (s.type === "reply_urgent" || s.type === "review_risk" || s.type === "follow_up") {
      // Select the first email from the suggestion
      const target = emails.find((e) => s.emailIds.includes(e.id));
      if (target) handleSelectEmail(target);
    } else if (s.type === "group_sender") {
      // Filter by sender
      const target = emails.find((e) => s.emailIds.includes(e.id));
      if (target) {
        setSearchInput(target.from_address);
        setSearch(target.from_address);
        setPage(1);
      }
    }
  }, [emails, toast]);

  // Snooze handler
  const handleSnoozeEmail = useCallback(async (email: Email, wakeAt: string, reason: string, contextNote?: string) => {
    if (!user?.id) return;
    try {
      await awsApi.snoozeEmail({
        user_id: user.id,
        email_id: email.id,
        wake_at: wakeAt,
        reason,
        context_note: contextNote,
      });
      setEmails((prev) => prev.filter((e) => e.id !== email.id));
      if (selectedEmail?.id === email.id) setSelectedEmail(null);
      toast({ title: `⏰ Snoozed until ${format(new Date(wakeAt), "MMM d, h:mm a")}` });
    } catch {
      toast({ title: "Failed to snooze", variant: "destructive" });
    }
  }, [user?.id, selectedEmail, toast]);

  // Fetch AI context suggestion when selecting an email
  const fetchAiSnoozeContext = useCallback(async (email: Email) => {
    setAiSnoozeContext(null);
    setLoadingAiSnooze(true);
    try {
      const { data } = await supabase.functions.invoke("suggest-snooze-context", {
        body: {
          subject: email.subject,
          from_name: email.from_name || email.from_address,
          snippet: email.snippet,
        },
      });
      setAiSnoozeContext(data?.suggestion || null);
    } catch {
      // silently fail
    } finally {
      setLoadingAiSnooze(false);
    }
  }, []);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Snoozed Wake-Up Banner */}
      {dueSnoozed.length > 0 && user?.id && (
        <SnoozedWakeUpBanner
          dueItems={dueSnoozed}
          userId={user.id}
          onDismiss={(snoozeId) => setDueSnoozed((prev) => prev.filter((d) => d.id !== snoozeId))}
          onOpenEmail={(emailId) => {
            setFilter("inbox");
            fetchEmails(1, "inbox", "");
            fetchDueSnoozed();
          }}
        />
      )}
      {/* Urgent Banner */}
      <UrgentBanner
        analysesMap={analysesMap}
        unreadEmailIds={unreadEmailIds}
        onFilterUrgent={() => {
          setCategoryFilter(null);
          setFilter("unread");
          setPage(1);
        }}
      />

      {/* Smart Suggestions Bar */}
      <InboxSuggestionBar
        suggestions={inboxSuggestions}
        onAction={handleSuggestionAction}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Inbox</h1>
          <Badge variant="secondary" className="text-xs">
            {totalEmails} emails
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => { setComposeReplyTo(null); setComposeInitialCc(""); setComposeOpen(true); }}>
            <PenSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Compose</span>
          </Button>
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search emails..."
              className="pl-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleBatchAnalyze} disabled={batchAnalyzing || loading}>
            {batchAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="hidden sm:inline">{batchProgress.done}/{batchProgress.total}</span>
              </>
            ) : (
              <>
                <Brain className="h-4 w-4" />
                <span className="hidden sm:inline">Analyze All</span>
              </>
            )}
          </Button>
          <LabelManager
            labels={labels}
            onCreateLabel={createLabel}
            onUpdateLabel={updateLabel}
            onDeleteLabel={deleteLabel}
          />
          <Button variant="outline" size="sm" onClick={syncAndLoad} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Sync</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-border px-4 py-2">
        <Tabs value={filter} onValueChange={(v) => { setFilter(v); setPage(1); }}>
          <TabsList>
            <TabsTrigger value="inbox">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
            <TabsTrigger value="starred">Starred</TabsTrigger>
            <TabsTrigger value="snoozed">Snoozed</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Account Filter Bar */}
      <AccountFilterBar
        selectedAccountIds={selectedAccountIds}
        onSelectionChange={(ids) => { setSelectedAccountIds(ids); setPage(1); }}
        accounts={accounts}
      />

      {/* Category filter */}
      <CategoryFilter selected={categoryFilter} onChange={setCategoryFilter} />

      {/* Label filter */}
      <LabelFilter labels={labels} selectedLabelId={labelFilter} onChange={setLabelFilter} />

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Email List */}
        <div
          className={`flex-1 overflow-y-auto border-r border-border ${
            selectedEmail ? "hidden md:block md:max-w-[50%]" : "w-full"
          }`}
        >
          {filter === "snoozed" ? (
            <SnoozedListView />
          ) : loading ? (
            <div className="space-y-1 p-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg p-3">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-4" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                  <Skeleton className="h-3 w-12" />
                </div>
              ))}
            </div>
          ) : fetchError ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <p className="text-destructive text-sm">{fetchError}</p>
              <Button variant="outline" size="sm" onClick={() => fetchEmails()}>
                <RefreshCw className="h-4 w-4 mr-1" /> Retry
              </Button>
            </div>
          ) : filteredEmails.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <p className="text-muted-foreground">
                {categoryFilter ? `No ${categoryFilter} emails found` : "No emails found"}
              </p>
              <Button variant="outline" size="sm" onClick={() => fetchEmails()}>
                <RefreshCw className="h-4 w-4 mr-1" /> Refresh
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredEmails.map((email) => {
                const analysis = analysesMap[email.id];
                const urgencyLevel = analysis ? getUrgencyLevel(analysis.urgency) : null;
                const urgencyDotClass = urgencyLevel ? URGENCY_DOT_COLORS[urgencyLevel] : null;
                const catClass = analysis
                  ? CATEGORY_COLORS[analysis.category] ?? CATEGORY_COLORS.general
                  : null;

                return (
                  <button
                    key={email.id}
                    onClick={() => handleSelectEmail(email)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                      selectedEmail?.id === email.id ? "bg-muted" : ""
                    } ${!email.is_read ? "bg-muted/30" : ""}`}
                  >
                    {/* Urgency dot */}
                    <div className="flex w-2.5 shrink-0 items-center justify-center">
                      {urgencyDotClass && (
                        <div className={`h-2 w-2 rounded-full ${urgencyDotClass}`} />
                      )}
                    </div>
                    <Checkbox onClick={(e) => e.stopPropagation()} className="shrink-0" />
                    <button onClick={(e) => handleStar(e, email)} className="shrink-0">
                      <Star
                        className={`h-4 w-4 ${
                          email.is_starred
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground hover:text-yellow-400"
                        }`}
                      />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {accounts.length > 1 && (
                          <AccountIndicator
                            provider={email.account_provider}
                            email={email.account_email}
                          />
                        )}
                        <span
                          className={`truncate text-sm ${
                            !email.is_read ? "font-semibold text-foreground" : "text-foreground/80"
                          }`}
                        >
                          {email.from_name || email.from_address}
                        </span>
                        {email.has_attachments && (
                          <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isMeetingEmail(email.subject, analysis?.category) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate("/calendar");
                            }}
                            title="View in Calendar"
                            className="hover:scale-125 transition-transform"
                          >
                            <CalendarIcon className="h-3 w-3 shrink-0 text-primary" />
                          </button>
                        )}
                        <p
                          className={`truncate text-sm ${
                            !email.is_read ? "font-medium text-foreground/90" : "text-muted-foreground"
                          }`}
                        >
                          {email.subject}
                        </p>
                        {threadCounts[normalizeSubject(email.subject)] >= 3 && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0 gap-0.5">
                            <MessageSquare className="h-2.5 w-2.5" />
                            {threadCounts[normalizeSubject(email.subject)]}
                          </Badge>
                        )}
                        {catClass && (
                          <span className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-0 text-[10px] font-medium leading-4 ${catClass}`}>
                            {analysis!.category}
                          </span>
                        )}
                        {analysis?.risk_flags && analysis.risk_flags.length > 0 && (
                          <RiskFlagBadges flags={analysis.risk_flags} size="sm" />
                        )}
                        {escalatingKeys.has(normalizeSubject(email.subject)) && (
                          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-red-500/30 bg-red-500/15 px-1.5 py-0 text-[10px] font-medium leading-4 text-red-400">
                            <TrendingDown className="h-2.5 w-2.5" />
                            escalating
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <p className="truncate text-xs text-muted-foreground">{email.snippet}</p>
                        {getLabelsForEmail(email.id).map((lbl) => (
                          <span
                            key={lbl.id}
                            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-1.5 py-0 text-[10px] font-medium leading-4 text-foreground/70"
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: lbl.color }} />
                            {lbl.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeDate(email.received_at)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedEmail && (
          <div className="flex flex-1 flex-col overflow-y-auto">
            <div className="flex items-center gap-2 border-b border-border p-4">
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSelectedEmail(null)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                setComposeForwardFrom(null);
                setComposeInitialCc("");
                setComposeReplyTo({
                  id: selectedEmail.id,
                  nylas_id: selectedEmail.nylas_id,
                  from_name: selectedEmail.from_name,
                  from_address: selectedEmail.from_address,
                  subject: selectedEmail.subject,
                  snippet: selectedEmail.snippet,
                  body: emailBody ?? undefined,
                  received_at: selectedEmail.received_at,
                  account_email: selectedEmail.account_email,
                });
                setComposeOpen(true);
              }}>
                <Reply className="h-4 w-4" />
                Reply
              </Button>
              {(selectedEmail.to_addresses?.length > 1 || selectedEmail.to_addresses?.some(r => r.email !== selectedEmail.from_address)) && (
                <Button variant="outline" size="sm" onClick={() => {
                  setComposeForwardFrom(null);
                  const userEmail = selectedEmail.account_email || user?.email || "";
                  const ccRecipients = (selectedEmail.to_addresses ?? [])
                    .filter(r => r.email !== selectedEmail.from_address && r.email !== userEmail)
                    .map(r => r.email);
                  setComposeInitialCc(ccRecipients.join(", "));
                  setComposeReplyTo({
                    id: selectedEmail.id,
                    nylas_id: selectedEmail.nylas_id,
                    from_name: selectedEmail.from_name,
                    from_address: selectedEmail.from_address,
                    subject: selectedEmail.subject,
                    snippet: selectedEmail.snippet,
                    body: emailBody ?? undefined,
                    received_at: selectedEmail.received_at,
                    account_email: selectedEmail.account_email,
                  });
                  setComposeOpen(true);
                }}>
                  <ReplyAll className="h-4 w-4" />
                  Reply All
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => {
                setComposeReplyTo(null);
                setComposeInitialCc("");
                setComposeForwardFrom({
                  from_name: selectedEmail.from_name,
                  from_address: selectedEmail.from_address,
                  to_addresses: selectedEmail.to_addresses,
                  subject: selectedEmail.subject,
                  body: emailBody ?? undefined,
                  snippet: selectedEmail.snippet,
                  received_at: selectedEmail.received_at,
                  has_attachments: selectedEmail.has_attachments,
                });
                setComposeOpen(true);
              }}>
                <Forward className="h-4 w-4" />
                Forward
              </Button>
              <div className="flex-1" />
              <Button variant="outline" size="sm" onClick={() => {
                const analysis = analysesMap[selectedEmail.id];
                const urgencyToPriority = (u: number) => u >= 4 ? "high" : u >= 3 ? "medium" : "low";
                setTaskInitialData({
                  title: selectedEmail.subject || "Follow up",
                  description: analysis?.summary ?? selectedEmail.snippet,
                  priority: analysis ? urgencyToPriority(analysis.urgency) : "medium",
                  email_id: selectedEmail.id,
                });
                setTaskModalOpen(true);
              }}>
                <ListTodo className="h-4 w-4" />
                <span className="hidden sm:inline">Create Task</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                setFollowupEmailId(selectedEmail.id);
                setFollowupModalOpen(true);
              }}>
                <CalendarClock className="h-4 w-4" />
                <span className="hidden sm:inline">Follow-up</span>
              </Button>
              <SnoozeDropdown
                onSnooze={(wakeAt, reason, contextNote) =>
                  handleSnoozeEmail(selectedEmail, wakeAt, reason, contextNote)
                }
                emailSubject={selectedEmail.subject}
                emailFrom={selectedEmail.from_name}
                emailSnippet={selectedEmail.snippet}
                aiContextSuggestion={aiSnoozeContext}
                loadingAiSuggestion={loadingAiSnooze}
              />
              <Button variant="ghost" size="icon" onClick={(e) => handleStar(e, selectedEmail)}>
                <Star className={`h-4 w-4 ${selectedEmail.is_starred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleArchive(selectedEmail)}>
                <Archive className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleMarkUnread(selectedEmail)}>
                <MailOpen className="h-4 w-4 text-muted-foreground" />
              </Button>
              <LabelSelector
                labels={labels}
                activeLabelsIds={emailLabelsMap[selectedEmail.id] ?? []}
                onToggle={(labelId) => toggleEmailLabel(selectedEmail.id, labelId)}
                onCreateLabel={createLabel}
              />
              <Button variant="ghost" size="icon" onClick={() => setSelectedEmail(null)} className="hidden md:flex">
                <X className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
            <div className="p-6 space-y-4">
              <h2 className="text-xl font-semibold text-foreground">
                {selectedEmail.subject || "(No subject)"}
              </h2>
              {/* Labels on detail view */}
              <div className="flex flex-wrap items-center gap-1.5">
                {getLabelsForEmail(selectedEmail.id).map((lbl) => (
                  <span
                    key={lbl.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-foreground/80"
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: lbl.color }} />
                    {lbl.name}
                  </span>
                ))}
                <LabelSelector
                  labels={labels}
                  activeLabelsIds={emailLabelsMap[selectedEmail.id] ?? []}
                  onToggle={(labelId) => toggleEmailLabel(selectedEmail.id, labelId)}
                  onCreateLabel={createLabel}
                  triggerVariant="badge"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowContactProfile(!showContactProfile)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary hover:bg-primary/30 transition-colors"
                  title="View contact profile"
                >
                  {(selectedEmail.from_name || selectedEmail.from_address || "?")[0].toUpperCase()}
                </button>
                <div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setShowContactProfile(!showContactProfile)}
                      className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {selectedEmail.from_name || selectedEmail.from_address}
                    </button>
                    {currentAnalysis?.sentiment && (() => {
                      const { emoji, color } = getSentimentEmoji(currentAnalysis.sentiment);
                      return <span className={`${color} text-sm`} title={`Tone: ${currentAnalysis.sentiment}`}>{emoji}</span>;
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground">{selectedEmail.from_address}</p>
                </div>
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatFullDate(selectedEmail.received_at)}
                </span>
              </div>

              {/* Contact Profile Panel */}
              {showContactProfile && (
                <ContactProfilePanel
                  email={selectedEmail.from_address}
                  name={selectedEmail.from_name}
                  onClose={() => setShowContactProfile(false)}
                  onNavigateToEmail={(emailId) => {
                    const target = emails.find((e) => e.id === emailId);
                    if (target) handleSelectEmail(target);
                    setShowContactProfile(false);
                  }}
                />
              )}

              {/* Email body */}
              {loadingBody ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : emailBody ? (
                <div
                  className="email-body-content rounded-lg border border-border bg-muted/30 p-4 overflow-x-auto [&_a]:text-primary [&_a]:underline [&_img]:max-w-full [&_img]:h-auto [&_*]:max-w-full"
                  dangerouslySetInnerHTML={{ __html: emailBody }}
                />
              ) : (
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                    {selectedEmail.snippet}
                  </p>
                </div>
              )}

              {/* Quick Reply with Template */}
              {currentAnalysis?.requires_response && templates.length > 0 && (
                <QuickReplyTemplates
                  templates={templates}
                  emailCategory={currentAnalysis?.category}
                  onUseTemplate={(t) => {
                    trackUsage(t.id);
                    setComposeForwardFrom(null);
                    setComposeInitialCc("");
                    setComposeInitialBody(t.body_template);
                    setComposeEmailCategory(currentAnalysis?.category);
                    setComposeReplyTo({
                      id: selectedEmail.id,
                      nylas_id: selectedEmail.nylas_id,
                      from_name: selectedEmail.from_name,
                      from_address: selectedEmail.from_address,
                      subject: selectedEmail.subject,
                      snippet: selectedEmail.snippet,
                      body: emailBody ?? undefined,
                      received_at: selectedEmail.received_at,
                      account_email: selectedEmail.account_email,
                    });
                    setComposeOpen(true);
                  }}
                />
              )}

              {/* Thread Summary */}
              <ThreadSummaryPanel
                selectedEmail={selectedEmail}
                allEmails={emails}
              />

              {/* Sentiment Trend */}
              <SentimentTrendPanel
                selectedEmail={selectedEmail}
                allEmails={emails}
                analysesMap={analysesMap}
              />

              {/* AI Insights */}
              <AIInsightsCard
                analysis={currentAnalysis}
                loading={analysisLoading}
                error={analysisError}
              />

              {/* Calendar Context - show for meeting-related emails */}
              {isMeetingEmail(selectedEmail.subject, currentAnalysis?.category) && (
                <CalendarContext />
              )}
            </div>
          </div>
        )}
      </div>

      <ComposeModal
        open={composeOpen}
        onClose={() => { setComposeOpen(false); setComposeReplyTo(null); setComposeForwardFrom(null); setComposeInitialBody(undefined); setComposeEmailCategory(undefined); }}
        replyTo={composeReplyTo ?? undefined}
        forwardFrom={composeForwardFrom ?? undefined}
        initialCc={composeInitialCc}
        sentiment={selectedEmail ? currentAnalysis?.sentiment : undefined}
        initialBody={composeInitialBody}
        emailCategory={composeEmailCategory}
      />

      <TaskModal
        open={taskModalOpen}
        onClose={() => { setTaskModalOpen(false); setTaskInitialData(undefined); }}
        onSave={async (data) => {
          if (!user?.id) return;
          await awsApi.createTask({ user_id: user.id, ...data });
          toast({ title: "Task created" });
        }}
        initialData={taskInitialData}
      />

      <FollowupModal
        open={followupModalOpen}
        onClose={() => { setFollowupModalOpen(false); setFollowupEmailId(undefined); }}
        onSave={async (data) => {
          if (!user?.id) return;
          await awsApi.createFollowup({ user_id: user.id, ...data });
          toast({ title: "Follow-up created" });
        }}
        initialEmailId={followupEmailId}
      />
    </div>
  );
}
