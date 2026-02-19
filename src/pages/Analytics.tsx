import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { awsApi } from "@/lib/awsApi";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  MailOpen,
  AlertTriangle,
  ShieldAlert,
  RefreshCw,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface AnalyticsData {
  overall: {
    total_emails: number;
    unread: number;
    starred: number;
    with_attachments: number;
    requires_response: number;
  };
  volume_by_day: { date: string; count: number }[];
  volume_by_hour: { hour: number; count: number }[];
  categories: { category: string; count: number }[];
  urgency_distribution: { urgency: number; count: number }[];
  urgency_trend: { week: string; avg_urgency: number }[];
  sentiments: { sentiment: string; count: number }[];
  top_senders: { email: string; name: string; count: number }[];
  risk_flags: { flag: string; count: number }[];
}

const PERIOD_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

const CATEGORY_COLORS: Record<string, string> = {
  marketing: "#3b82f6",
  personal: "#10b981",
  billing: "#f59e0b",
  legal: "#ef4444",
  general: "#6b7280",
  scheduling: "#8b5cf6",
  vendor: "#06b6d4",
  client: "#ec4899",
  internal: "#14b8a6",
  insurance: "#f97316",
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#10b981",
  neutral: "#6b7280",
  negative: "#ef4444",
  urgent: "#f59e0b",
};

const URGENCY_COLORS = ["#10b981", "#84cc16", "#eab308", "#f97316", "#ef4444"];

function formatHour(hour: number): string {
  if (hour === 0) return "12AM";
  if (hour < 12) return `${hour}AM`;
  if (hour === 12) return "12PM";
  return `${hour - 12}PM`;
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  sub?: string;
  accent?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-4 rounded-xl border border-border bg-card p-5 ${onClick ? "cursor-pointer hover:bg-muted/30" : ""}`}
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${accent ?? "bg-primary/10 text-primary"}`}>
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        {value === null ? (
          <Skeleton className="mt-1 h-7 w-16" />
        ) : (
          <>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
          </>
        )}
      </div>
      {onClick && <span className="text-muted-foreground text-xs">→</span>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-5 py-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function Analytics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);

  const fetchAnalytics = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await awsApi.getAnalytics(user.id, period);
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id, period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const busiestHour = useMemo(() => {
    if (!data?.volume_by_hour?.length) return null;
    return data.volume_by_hour.reduce((a, b) => (b.count > a.count ? b : a));
  }, [data]);

  const totalRiskFlags = useMemo(() => {
    if (!data?.risk_flags) return 0;
    return data.risk_flags.reduce((a, b) => a + b.count, 0);
  }, [data]);

  const totalSentimentAnalyzed = useMemo(() => {
    if (!data?.sentiments) return 0;
    return data.sentiments.reduce((a, b) => a + b.count, 0);
  }, [data]);

  const urgencyTrendDir = useMemo(() => {
    if (!data?.urgency_trend || data.urgency_trend.length < 2) return "stable";
    const first = data.urgency_trend[0].avg_urgency;
    const last = data.urgency_trend[data.urgency_trend.length - 1].avg_urgency;
    if (last > first + 0.3) return "up";
    if (last < first - 0.3) return "down";
    return "stable";
  }, [data]);

  const maxSenderCount = useMemo(() => {
    if (!data?.top_senders?.length) return 1;
    return Math.max(...data.top_senders.map((s) => s.count), 1);
  }, [data]);

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: "hsl(222 47% 9%)",
      border: "1px solid hsl(217 33% 17%)",
      borderRadius: "0.5rem",
      color: "hsl(210 40% 96%)",
      fontSize: "12px",
    },
  };

  if (loading) {
    return (
      <div className="space-y-6 p-4 sm:p-6 max-w-6xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Email Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Insights from your email activity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  period === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" onClick={fetchAnalytics}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Mail className="h-5 w-5" />}
          label="Total Emails"
          value={data?.overall?.total_emails ?? null}
          onClick={() => navigate("/inbox")}
        />
        <StatCard
          icon={<MailOpen className="h-5 w-5" />}
          label="Unread"
          value={data?.overall?.unread ?? null}
          sub={data?.overall ? `${Math.round((data.overall.unread / Math.max(data.overall.total_emails, 1)) * 100)}% of total` : undefined}
          onClick={() => navigate("/inbox?filter=unread")}
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Requires Response"
          value={data?.overall?.requires_response ?? null}
          accent={data?.overall?.requires_response ? "bg-orange-500/10 text-orange-400" : undefined}
          onClick={() => navigate("/inbox?filter=requires_response")}
        />
        <StatCard
          icon={<ShieldAlert className="h-5 w-5" />}
          label="Risk Flags"
          value={totalRiskFlags}
          accent={totalRiskFlags > 0 ? "bg-red-500/10 text-red-400" : undefined}
          onClick={() => navigate("/inbox?filter=urgent")}
        />
      </div>

      {/* Row 1: Volume + Busiest Hours */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Email Volume Over Time">
          {data?.volume_by_day?.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.volume_by_day}>
                <defs>
                  <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(217 91% 60%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(217 91% 60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }}
                  tickFormatter={(d) => {
                    const date = new Date(d);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} />
                <Tooltip {...tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(217 91% 60%)"
                  fill="url(#volumeGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground py-8 text-center">No data available</p>
          )}
        </ChartCard>

        <ChartCard title={`Busiest Hours${busiestHour ? ` — Peak: ${formatHour(busiestHour.hour)}` : ""}`}>
          {data?.volume_by_hour?.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.volume_by_hour}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }}
                  tickFormatter={formatHour}
                />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} />
                <Tooltip {...tooltipStyle} labelFormatter={(h) => formatHour(Number(h))} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {data.volume_by_hour.map((entry) => (
                    <Cell
                      key={entry.hour}
                      fill={busiestHour && entry.hour === busiestHour.hour ? "#f59e0b" : "hsl(217 91% 60%)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground py-8 text-center">No data available</p>
          )}
        </ChartCard>
      </div>

      {/* Row 2: Categories + Sentiments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Category Breakdown">
          {data?.categories?.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={data.categories}
                  dataKey="count"
                  nameKey="category"
                  cx="40%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={2}
                  onClick={(entry: any) => {
                    if (entry?.category) navigate(`/inbox?category=${entry.category}`);
                  }}
                  className="cursor-pointer"
                >
                  {data.categories.map((entry) => (
                    <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] ?? "#6b7280"} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground py-8 text-center">No data available</p>
          )}
        </ChartCard>

        <ChartCard title="Sentiment Distribution">
          {data?.sentiments?.length ? (
            <div className="relative">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={data.sentiments}
                    dataKey="count"
                    nameKey="sentiment"
                    cx="40%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={2}
                  >
                    {data.sentiments.map((entry) => (
                      <Cell key={entry.sentiment} fill={SENTIMENT_COLORS[entry.sentiment] ?? "#6b7280"} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center" style={{ left: "13%" }}>
                <div className="text-center" style={{ width: "54%" }}>
                  <p className="text-lg font-bold text-foreground">{totalSentimentAnalyzed}</p>
                  <p className="text-[10px] text-muted-foreground">analyzed</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-8 text-center">No data available</p>
          )}
        </ChartCard>
      </div>

      {/* Row 3: Urgency Distribution + Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Urgency Distribution">
          {data?.urgency_distribution?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.urgency_distribution} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} />
                <YAxis
                  dataKey="urgency"
                  type="category"
                  tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }}
                  tickFormatter={(v) => `Level ${v}`}
                  width={55}
                />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {data.urgency_distribution.map((entry) => (
                    <Cell key={entry.urgency} fill={URGENCY_COLORS[Math.min(entry.urgency - 1, 4)]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground py-8 text-center">No data available</p>
          )}
        </ChartCard>

        <ChartCard title={`Urgency Trend ${urgencyTrendDir === "up" ? "↑ Rising" : urgencyTrendDir === "down" ? "↓ Falling" : "→ Stable"}`}>
          {data?.urgency_trend?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.urgency_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }}
                  tickFormatter={(w) => {
                    const d = new Date(w);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }}
                  domain={[0, 5]}
                />
                <Tooltip {...tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="avg_urgency"
                  stroke={urgencyTrendDir === "up" ? "#ef4444" : urgencyTrendDir === "down" ? "#10b981" : "#6b7280"}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground py-8 text-center">No data available</p>
          )}
        </ChartCard>
      </div>

      {/* Row 4: Top Senders + Risk Flags */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartCard title="Top Senders">
            {data?.top_senders?.length ? (
              <div className="space-y-2">
                {data.top_senders.slice(0, 10).map((sender) => (
                    <button
                      key={sender.email}
                      onClick={() => navigate(`/inbox?from=${encodeURIComponent(sender.email)}`)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors text-left cursor-pointer"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                        {(sender.name || sender.email).slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">{sender.name || sender.email}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{sender.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 rounded-full bg-primary/20 w-24">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${(sender.count / maxSenderCount) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-foreground w-8 text-right">{sender.count}</span>
                        <span className="text-muted-foreground text-[10px]">→</span>
                      </div>
                    </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">No data available</p>
            )}
          </ChartCard>
        </div>

        {data?.risk_flags && data.risk_flags.length > 0 && (
          <ChartCard title="Risk Flags Summary">
            <div className="space-y-2">
              {data.risk_flags.map((rf) => (
                <div key={rf.flag} className="flex items-center justify-between">
                  <Badge variant="destructive" className="text-[10px]">
                    <ShieldAlert className="h-2.5 w-2.5 mr-1" />
                    {rf.flag.replace(/_/g, " ")}
                  </Badge>
                  <span className="text-xs font-bold text-foreground">{rf.count}</span>
                </div>
              ))}
            </div>
          </ChartCard>
        )}
      </div>
    </div>
  );
}
