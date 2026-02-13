import { useEffect, useState, useCallback, useMemo } from "react";
import { format, differenceInMinutes, differenceInHours, differenceInDays } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useLabels } from "@/hooks/useLabels";
import { awsApi } from "@/lib/awsApi";
import { getOrAnalyze } from "@/services/aiAnalysis";
import { generateSuggestions, SmartSuggestion } from "@/services/smartSuggestions";
import InboxSuggestionBar from "@/components/suggestions/InboxSuggestionBar";
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

  const [emails, setEmails] = useState<Email[]>([]);
  const [totalEmails, setTotalEmails] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("inbox");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
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

  const fetchEmails = useCallback(
    async (p = page, f = filter, s = search) => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const data: EmailsResponse = await awsApi.getEmails(user.id, p, limit, f, s);
        setEmails(data.emails ?? []);
        setTotalEmails(data.total ?? 0);
        setTotalPages(data.total_pages ?? 1);
      } catch {
        toast({ title: "Failed to load emails", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    },
    [user?.id, page, filter, search, toast]
  );

  const syncAndLoad = useCallback(async () => {
    if (!user?.id) return;
    setSyncing(true);
    try {
      const syncResult = await awsApi.syncEmails(user.id);
      const newCount = syncResult?.new_emails ?? syncResult?.synced ?? 0;
      toast({ title: `Synced ${newCount} new email${newCount !== 1 ? "s" : ""}` });
    } catch {
      toast({ title: "Sync failed", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
    fetchEmails(1, filter, search);
    fetchAnalyses();
  }, [user?.id, filter, search, fetchEmails, fetchAnalyses, toast]);

  useEffect(() => {
    if (user?.id) syncAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (user?.id && !syncing) fetchEmails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filter, search]);

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

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
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
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

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
          {loading ? (
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
          ) : filteredEmails.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground">
                {categoryFilter ? `No ${categoryFilter} emails found` : "No emails found"}
              </p>
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
                        <p
                          className={`truncate text-sm ${
                            !email.is_read ? "font-medium text-foreground/90" : "text-muted-foreground"
                          }`}
                        >
                          {email.subject}
                        </p>
                        {catClass && (
                          <span className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-0 text-[10px] font-medium leading-4 ${catClass}`}>
                            {analysis!.category}
                          </span>
                        )}
                        {analysis?.risk_flags && analysis.risk_flags.length > 0 && (
                          <RiskFlagBadges flags={analysis.risk_flags} size="sm" />
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
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
                  {(selectedEmail.from_name || selectedEmail.from_address || "?")[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {selectedEmail.from_name || selectedEmail.from_address}
                  </p>
                  <p className="text-xs text-muted-foreground">{selectedEmail.from_address}</p>
                </div>
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatFullDate(selectedEmail.received_at)}
                </span>
              </div>

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

              {/* AI Insights */}
              <AIInsightsCard
                analysis={currentAnalysis}
                loading={analysisLoading}
                error={analysisError}
              />
            </div>
          </div>
        )}
      </div>

      <ComposeModal
        open={composeOpen}
        onClose={() => { setComposeOpen(false); setComposeReplyTo(null); setComposeForwardFrom(null); }}
        replyTo={composeReplyTo ?? undefined}
        forwardFrom={composeForwardFrom ?? undefined}
        initialCc={composeInitialCc}
      />
    </div>
  );
}
