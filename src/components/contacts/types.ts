export interface ContactListItem {
  email: string;
  name: string;
  email_count: number;
  last_email: string;
  first_email: string;
}

export interface ContactProfile {
  email: string;
  name: string;
  total_emails: number;
  received_from: number;
  sent_to: number;
  first_contact: string;
  last_contact: string;
  categories: Record<string, number>;
  avg_urgency: number;
  sentiment_trend: string[];
  risk_flags_seen: string[];
  requires_response_count: number;
  recent_emails: {
    id: string;
    subject: string;
    received_at: string;
    sentiment: string;
  }[];
  open_tasks: {
    id: string;
    title: string;
    status: string;
    due_date?: string;
  }[];
}

export interface ContactHistoryEmail {
  id: string;
  subject: string;
  from_address: string;
  from_name: string;
  snippet: string;
  received_at: string;
  category: string;
  urgency: number;
  sentiment: string;
}

export function getInitials(name: string | null | undefined): string {
  if (!name || typeof name !== "string") return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

export function getAvatarColor(name: string | null | undefined): string {
  const colors = [
    "bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-orange-500",
    "bg-pink-500", "bg-cyan-500", "bg-yellow-500", "bg-red-500",
    "bg-indigo-500", "bg-teal-500",
  ];
  if (!name || typeof name !== "string") return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function getSentimentDotColor(sentiment: unknown): string {
  const s = String(sentiment ?? "").toLowerCase();
  if (s.includes("positive")) return "bg-emerald-400";
  if (s.includes("negative")) return "bg-red-400";
  return "bg-muted-foreground/50";
}

export function getSentimentTrendDirection(sentiments: unknown[]): "improving" | "stable" | "declining" {
  if (!sentiments || sentiments.length < 2) return "stable";
  const score = (s: unknown) => {
    const l = String(s ?? "").toLowerCase();
    if (l.includes("positive")) return 1;
    if (l.includes("negative")) return -1;
    return 0;
  };
  const half = Math.floor(sentiments.length / 2);
  const firstHalf = sentiments.slice(0, half).reduce<number>((a, s) => a + score(s), 0) / half;
  const secondHalf = sentiments.slice(half).reduce<number>((a, s) => a + score(s), 0) / (sentiments.length - half);
  const diff = secondHalf - firstHalf;
  if (diff > 0.3) return "improving";
  if (diff < -0.3) return "declining";
  return "stable";
}
