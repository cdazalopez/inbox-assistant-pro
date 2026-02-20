import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { awsApi } from "@/lib/awsApi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ContactProfile,
  ContactHistoryEmail,
  getInitials,
  getAvatarColor,
  getSentimentDotColor,
  getSentimentTrendDirection,
} from "./types";
import { format } from "date-fns";
import {
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Mail,
  AlertTriangle,
  ListTodo,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Users,
} from "lucide-react";

interface Props {
  email: string;
  name?: string;
  onClose: () => void;
}

// Group emails by thread_id to show chains
function groupByThread(emails: ContactHistoryEmail[]) {
  const threads: Record<string, ContactHistoryEmail[]> = {};
  const order: string[] = [];
  for (const e of emails) {
    const key = (e as any).thread_id || e.id;
    if (!threads[key]) {
      threads[key] = [];
      order.push(key);
    }
    threads[key].push(e);
  }
  return order.map((k) => threads[k]);
}

export default function ContactProfilePanel({ email, name, onClose }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ContactProfile | null>(null);
  const [history, setHistory] = useState<ContactHistoryEmail[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [showAllHistory, setShowAllHistory] = useState(false);
  // Keep a stable ref to the email so re-renders of parent don't re-fetch
  const emailRef = useRef(email);

  useEffect(() => {
    if (!user?.id || !email) return;
    // Only re-fetch if email actually changed
    if (email === emailRef.current && profile !== null) return;
    emailRef.current = email;

    setLoadingProfile(true);
    setLoadingHistory(true);
    setProfile(null);
    setHistory([]);

    awsApi
      .getContactProfile(user.id, email)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoadingProfile(false));

    awsApi
      .getContactHistory(user.id, email, 30)
      .then((emails) => setHistory(emails ?? []))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, user?.id]);

  const initials = getInitials(name || email);
  const avatarColor = getAvatarColor(name || email);

  const handleEmailClick = (emailId: string) => {
    navigate(`/inbox?emailId=${emailId}`);
  };

  const toggleThread = (threadKey: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(threadKey)) next.delete(threadKey);
      else next.add(threadKey);
      return next;
    });
  };

  if (loadingProfile) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground">No profile data found</p>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  const trendDir = getSentimentTrendDirection(profile.sentiment_trend ?? []);
  const TrendIcon = trendDir === "improving" ? TrendingUp : trendDir === "declining" ? TrendingDown : Minus;
  const trendColor =
    trendDir === "improving" ? "text-emerald-400" : trendDir === "declining" ? "text-red-400" : "text-muted-foreground";
  const urgencyColor =
    profile.avg_urgency >= 4 ? "text-red-400" : profile.avg_urgency >= 2.5 ? "text-yellow-400" : "text-emerald-400";
  const totalComms = profile.received_from + profile.sent_to;
  const receivedPct = totalComms > 0 ? (profile.received_from / totalComms) * 100 : 50;

  // Group history into threads
  const threads = groupByThread(history);
  const displayedThreads = showAllHistory ? threads : threads.slice(0, 5);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white shrink-0 ${avatarColor}`}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{profile.name || email}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-bold text-foreground">{profile.total_emails}</p>
            <p className="text-[10px] text-muted-foreground">Total Emails</p>
          </div>
          <div>
            <p className="text-xs font-medium text-foreground">
              {profile.first_contact ? format(new Date(profile.first_contact), "MMM yyyy") : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">First Contact</p>
          </div>
          <div>
            <p className="text-xs font-medium text-foreground">
              {profile.last_contact ? format(new Date(profile.last_contact), "MMM d") : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">Last Contact</p>
          </div>
        </div>

        {/* Communication Split */}
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">Communication Split</p>
          <div className="flex h-2 w-full rounded-full overflow-hidden bg-muted">
            <div className="bg-primary rounded-l-full" style={{ width: `${receivedPct}%` }} />
            <div className="bg-emerald-500 rounded-r-full" style={{ width: `${100 - receivedPct}%` }} />
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[10px] text-primary">Received {profile.received_from}</span>
            <span className="text-[10px] text-emerald-400">Sent {profile.sent_to}</span>
          </div>
        </div>

        {/* Sentiment Trend */}
        {profile.sentiment_trend && profile.sentiment_trend.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <p className="text-[10px] text-muted-foreground">Sentiment Trend</p>
              <TrendIcon className={`h-3 w-3 ${trendColor}`} />
              <span className={`text-[10px] font-medium capitalize ${trendColor}`}>{trendDir}</span>
            </div>
            <div className="flex gap-1">
              {profile.sentiment_trend.slice(-10).map((s, i) => (
                <div key={i} className={`h-2 w-2 rounded-full ${getSentimentDotColor(s)}`} title={s} />
              ))}
            </div>
          </div>
        )}

        {/* Categories */}
        {profile.categories && Object.keys(profile.categories).length > 0 && (
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Categories</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(profile.categories)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, count]) => (
                  <Badge key={cat} variant="secondary" className="text-[10px] py-0 h-5">
                    {cat}: {count}
                  </Badge>
                ))}
            </div>
          </div>
        )}

        {/* Average Urgency */}
        <div className="flex items-center gap-2">
          <p className="text-[10px] text-muted-foreground">Avg Urgency</p>
          <span className={`text-sm font-bold ${urgencyColor}`}>{profile.avg_urgency?.toFixed(1) ?? "—"}</span>
        </div>

        {/* Risk Flags */}
        {profile.risk_flags_seen && profile.risk_flags_seen.length > 0 && (
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Risk Flags Seen</p>
            <div className="flex flex-wrap gap-1">
              {profile.risk_flags_seen.map((flag) => (
                <Badge key={flag} variant="destructive" className="text-[10px] py-0 h-5">
                  <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                  {flag.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Open Tasks */}
        {profile.open_tasks && profile.open_tasks.length > 0 && (
          <div>
            <div className="flex items-center gap-1 mb-1">
              <ListTodo className="h-3 w-3 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground">Open Tasks ({profile.open_tasks.length})</p>
            </div>
            <div className="space-y-1">
              {profile.open_tasks.map((t) => (
                <div key={t.id} className="text-xs text-foreground/80 truncate">
                  • {t.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Email History with Thread Chains */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <Mail className="h-3 w-3 text-muted-foreground" />
            <p className="text-[10px] text-muted-foreground font-medium">
              Email History
              {loadingHistory && <span className="ml-1 opacity-60">loading...</span>}
              {!loadingHistory && history.length > 0 && <span className="ml-1">({history.length})</span>}
            </p>
          </div>

          {loadingHistory ? (
            <div className="space-y-1.5">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No email history found</p>
          ) : (
            <div className="space-y-1.5">
              {displayedThreads.map((threadEmails, ti) => {
                const first = threadEmails[0];
                const threadKey = (first as any).thread_id || first.id;
                const isChain = threadEmails.length > 1;
                const isExpanded = expandedThreads.has(threadKey);
                // Collect unique participants in chain
                const participants = [
                  ...new Set(threadEmails.map((e) => e.from_name || e.from_address).filter(Boolean)),
                ];

                return (
                  <div key={threadKey} className="rounded-lg border border-border/60 overflow-hidden">
                    {/* Thread header — always clickable to open first email */}
                    <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/20 hover:bg-muted/40 transition-colors">
                      {/* Open email button */}
                      <button
                        onClick={() => handleEmailClick(first.id)}
                        className="flex-1 flex items-center gap-2 text-left min-w-0"
                      >
                        <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${getSentimentDotColor(first.sentiment)}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-foreground/90 truncate font-medium">
                            {first.subject || "(No subject)"}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-muted-foreground truncate">
                              {first.from_name || first.from_address}
                            </span>
                            {first.category && (
                              <Badge variant="secondary" className="text-[9px] py-0 h-3.5 px-1">
                                {first.category}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] text-muted-foreground">
                            {first.received_at ? format(new Date(first.received_at), "MMM d") : ""}
                          </span>
                          <ExternalLink className="h-3 w-3 text-muted-foreground/60" />
                        </div>
                      </button>

                      {/* Expand chain button if more than 1 email in thread */}
                      {isChain && (
                        <button
                          onClick={() => toggleThread(threadKey)}
                          className="flex items-center gap-0.5 rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-medium shrink-0 hover:bg-primary/20 transition-colors"
                        >
                          <Users className="h-2.5 w-2.5" />
                          {threadEmails.length}
                          {isExpanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                        </button>
                      )}
                    </div>

                    {/* Expanded chain emails */}
                    {isChain && isExpanded && (
                      <div className="border-t border-border/40">
                        {/* Participants */}
                        {participants.length > 1 && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-muted/10 border-b border-border/30">
                            <Users className="h-2.5 w-2.5 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground truncate">
                              {participants.join(", ")}
                            </span>
                          </div>
                        )}
                        {threadEmails.map((e, ei) => (
                          <button
                            key={e.id}
                            onClick={() => handleEmailClick(e.id)}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted/30 transition-colors border-b border-border/20 last:border-b-0"
                          >
                            <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${getSentimentDotColor(e.sentiment)}`} />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-foreground/80 truncate">
                                <span className="text-[10px] text-muted-foreground mr-1">#{ei + 1}</span>
                                {e.from_name || e.from_address}
                              </p>
                              {e.snippet && <p className="text-[10px] text-muted-foreground truncate">{e.snippet}</p>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[10px] text-muted-foreground">
                                {e.received_at ? format(new Date(e.received_at), "MMM d") : ""}
                              </span>
                              <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/50" />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {threads.length > 5 && (
                <button
                  onClick={() => setShowAllHistory((v) => !v)}
                  className="w-full text-center text-xs text-primary hover:text-primary/80 py-1 transition-colors"
                >
                  {showAllHistory ? "Show less" : `Show all ${threads.length} threads`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
