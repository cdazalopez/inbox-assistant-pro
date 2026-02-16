import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { awsApi } from "@/lib/awsApi";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Clock, User, ArrowRight } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

interface MiniAnalytics {
  volume_by_day: { date: string; count: number }[];
  volume_by_hour: { hour: number; count: number }[];
  top_senders: { email: string; name: string; count: number }[];
}

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

export default function InboxInsightsCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<MiniAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    awsApi.getAnalytics(user.id, 7)
      .then((res) => setData(res))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [user?.id]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  if (!data) return null;

  const busiestHour = data.volume_by_hour?.length
    ? data.volume_by_hour.reduce((a, b) => (b.count > a.count ? b : a))
    : null;

  const topSender = data.top_senders?.[0] ?? null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-5 py-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Inbox Insights</h3>
      </div>
      <div className="px-5 py-4 space-y-3">
        {/* Sparkline */}
        {data.volume_by_day?.length > 0 && (
          <div className="h-12">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.volume_by_day}>
                <defs>
                  <linearGradient id="insightGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(217 91% 60%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(217 91% 60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(217 91% 60%)"
                  fill="url(#insightGrad)"
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Quick stats */}
        <div className="space-y-1.5">
          {busiestHour && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Busiest hour: <span className="font-medium text-foreground">{formatHour(busiestHour.hour)}</span></span>
            </div>
          )}
          {topSender && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span>Top sender: <span className="font-medium text-foreground">{topSender.name || topSender.email} ({topSender.count})</span></span>
            </div>
          )}
        </div>

        {/* Link */}
        <button
          onClick={() => navigate("/analytics")}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          View Full Analytics
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
