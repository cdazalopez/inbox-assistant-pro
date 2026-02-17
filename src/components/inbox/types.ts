export interface Email {
  id: string;
  nylas_id: string;
  subject: string;
  from_name: string;
  from_address: string;
  to_addresses: { name?: string; email: string }[];
  snippet: string;
  received_at: string;
  is_read: boolean;
  is_starred: boolean;
  has_attachments: boolean;
  labels?: string[];
  account_email?: string;
  account_provider?: string;
}

export interface EmailsResponse {
  emails: Email[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface EmailAnalysis {
  category: string;
  urgency: number;
  sentiment: string;
  requires_response: boolean;
  risk_flags: string[];
  summary: string;
  suggested_reply: string;
  confidence: number;
}

export const CATEGORY_COLORS: Record<string, string> = {
  client: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  billing: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  legal: "bg-red-500/20 text-red-400 border-red-500/30",
  insurance: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  vendor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  scheduling: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  marketing: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  personal: "bg-muted text-muted-foreground border-border",
  internal: "bg-muted text-muted-foreground border-border",
  general: "bg-muted text-muted-foreground border-border",
};

export const SENTIMENT_COLORS: Record<string, string> = {
  positive: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  negative: "bg-red-500/20 text-red-400 border-red-500/30",
  neutral: "bg-muted text-muted-foreground border-border",
  urgent: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

export const URGENCY_DOT_COLORS: Record<string, string> = {
  low: "bg-emerald-500",
  medium: "bg-yellow-500",
  high: "bg-red-500",
};

export function getUrgencyLevel(urgency: number): "low" | "medium" | "high" {
  if (urgency <= 2) return "low";
  if (urgency === 3) return "medium";
  return "high";
}

export const ALL_CATEGORIES = [
  "client", "vendor", "billing", "legal", "insurance",
  "scheduling", "marketing", "personal", "internal", "general",
] as const;
