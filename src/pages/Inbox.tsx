import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { awsApi } from "@/lib/awsApi";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
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
} from "lucide-react";

interface Email {
  id: string;
  subject: string;
  from_name: string;
  from_email: string;
  snippet: string;
  date: string;
  is_read: boolean;
  is_starred: boolean;
  has_attachments: boolean;
  labels?: string[];
}

interface EmailsResponse {
  emails: Email[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

function formatRelativeDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Inbox() {
  const { user } = useAuth();
  const { toast } = useToast();

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

  const limit = 25;

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
  }, [user?.id, filter, search, fetchEmails, toast]);

  // Auto-sync on mount
  useEffect(() => {
    if (user?.id) syncAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Refetch when page/filter/search change (not on mount)
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
    if (!email.is_read) {
      try {
        await awsApi.updateEmail(email.id, "mark_read");
        setEmails((prev) =>
          prev.map((em) => (em.id === email.id ? { ...em, is_read: true } : em))
        );
      } catch {
        /* silent */
      }
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Inbox</h1>
          <Badge variant="secondary" className="text-xs">
            {totalEmails} emails
          </Badge>
        </div>
        <div className="flex items-center gap-2">
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
          <Button
            variant="outline"
            size="sm"
            onClick={syncAndLoad}
            disabled={syncing}
          >
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
          ) : emails.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground">No emails found</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {emails.map((email) => (
                <button
                  key={email.id}
                  onClick={() => handleSelectEmail(email)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                    selectedEmail?.id === email.id ? "bg-muted" : ""
                  } ${!email.is_read ? "bg-muted/30" : ""}`}
                >
                  <Checkbox
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0"
                  />
                  <button
                    onClick={(e) => handleStar(e, email)}
                    className="shrink-0"
                  >
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
                        {email.from_name || email.from_email}
                      </span>
                      {email.has_attachments && (
                        <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                      )}
                    </div>
                    <p
                      className={`truncate text-sm ${
                        !email.is_read ? "font-medium text-foreground/90" : "text-muted-foreground"
                      }`}
                    >
                      {email.subject}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{email.snippet}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelativeDate(email.date)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
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
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setSelectedEmail(null)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1" />
              <Button variant="ghost" size="icon" onClick={(e) => handleStar(e, selectedEmail)}>
                <Star
                  className={`h-4 w-4 ${
                    selectedEmail.is_starred
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground"
                  }`}
                />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleArchive(selectedEmail)}>
                <Archive className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleMarkUnread(selectedEmail)}>
                <MailOpen className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedEmail(null)}
                className="hidden md:flex"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
            <div className="p-6 space-y-4">
              <h2 className="text-xl font-semibold text-foreground">
                {selectedEmail.subject || "(No subject)"}
              </h2>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
                  {(selectedEmail.from_name || selectedEmail.from_email || "?")[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {selectedEmail.from_name || selectedEmail.from_email}
                  </p>
                  <p className="text-xs text-muted-foreground">{selectedEmail.from_email}</p>
                </div>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(selectedEmail.date).toLocaleString()}
                </span>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                  {selectedEmail.snippet}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
