import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { awsApi } from "@/lib/awsApi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ContactProfile,
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
} from "lucide-react";

interface Props {
  email: string;
  name?: string;
  onClose: () => void;
  onNavigateToEmail?: (emailId: string) => void;
}

export default function ContactProfilePanel({ email, name, onClose, onNavigateToEmail }: Props) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ContactProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || !email) return;
    setLoading(true);
    awsApi.getContactProfile(user.id, email)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [user?.id, email]);

  const initials = getInitials(name || email);
  const avatarColor = getAvatarColor(name || email);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!profile) return null;

  const trendDir = getSentimentTrendDirection(profile.sentiment_trend ?? []);
  const TrendIcon = trendDir === "improving" ? TrendingUp : trendDir === "declining" ? TrendingDown : Minus;
  const trendColor = trendDir === "improving" ? "text-emerald-400" : trendDir === "declining" ? "text-red-400" : "text-muted-foreground";
  const urgencyColor = profile.avg_urgency >= 4 ? "text-red-400" : profile.avg_urgency >= 2.5 ? "text-yellow-400" : "text-emerald-400";

  const totalComms = profile.received_from + profile.sent_to;
  const receivedPct = totalComms > 0 ? (profile.received_from / totalComms) * 100 : 50;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor}`}>
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

      <div className="p-4 space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-bold text-foreground">{profile.total_emails}</p>
            <p className="text-[10px] text-muted-foreground">Total Emails</p>
          </div>
          <div>
            <p className="text-xs font-medium text-foreground">{profile.first_contact ? format(new Date(profile.first_contact), "MMM yyyy") : "—"}</p>
            <p className="text-[10px] text-muted-foreground">First Contact</p>
          </div>
          <div>
            <p className="text-xs font-medium text-foreground">{profile.last_contact ? format(new Date(profile.last_contact), "MMM d") : "—"}</p>
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
              {Object.entries(profile.categories).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
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
                <div key={t.id} className="text-xs text-foreground/80 truncate">• {t.title}</div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Emails */}
        {profile.recent_emails && profile.recent_emails.length > 0 && (
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Mail className="h-3 w-3 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground">Recent Emails</p>
            </div>
            <div className="space-y-1">
              {profile.recent_emails.slice(0, 5).map((e) => (
                <button
                  key={e.id}
                  onClick={() => onNavigateToEmail?.(e.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${getSentimentDotColor(e.sentiment)}`} />
                  <span className="text-xs text-foreground/80 truncate flex-1">{e.subject}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {e.received_at ? format(new Date(e.received_at), "MMM d") : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
