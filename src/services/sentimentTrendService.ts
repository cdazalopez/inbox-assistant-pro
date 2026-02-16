import { EmailAnalysis } from "@/components/inbox/types";
import { normalizeSubject } from "@/services/threadSummaryService";

export type SentimentValue = "positive" | "neutral" | "negative" | "mixed" | "urgent";

export interface SentimentPoint {
  emailId: string;
  from: string;
  date: string;
  sentiment: SentimentValue;
  score: number; // -1 to 1
}

export interface SentimentTrend {
  points: SentimentPoint[];
  direction: "improving" | "escalating" | "stable";
  isEscalating: boolean;
  previousSentiment: SentimentValue | null;
  currentSentiment: SentimentValue | null;
  messageCount: number;
}

const SENTIMENT_SCORES: Record<string, number> = {
  positive: 1,
  neutral: 0,
  mixed: -0.3,
  negative: -0.8,
  urgent: -0.5,
};

export function getSentimentScore(sentiment: string): number {
  return SENTIMENT_SCORES[sentiment] ?? 0;
}

export function getSentimentEmoji(sentiment: string): { emoji: string; color: string } {
  switch (sentiment) {
    case "positive": return { emoji: "😊", color: "text-emerald-400" };
    case "negative": return { emoji: "😠", color: "text-red-400" };
    case "mixed": return { emoji: "🤔", color: "text-yellow-400" };
    case "urgent": return { emoji: "😠", color: "text-red-400" };
    default: return { emoji: "😐", color: "text-muted-foreground" };
  }
}

export function getSentimentBarColor(sentiment: string): string {
  switch (sentiment) {
    case "positive": return "bg-emerald-500";
    case "negative": return "bg-red-500";
    case "mixed": return "bg-yellow-500";
    case "urgent": return "bg-red-500";
    default: return "bg-muted-foreground/40";
  }
}

export function analyzeThreadSentiment(
  emails: { id: string; from_name: string; from_address: string; subject: string; received_at: string }[],
  analysesMap: Record<string, EmailAnalysis>
): SentimentTrend | null {
  const threadKey = normalizeSubject(emails[0]?.subject ?? "");
  const threadEmails = emails
    .filter((e) => normalizeSubject(e.subject) === threadKey)
    .sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime());

  if (threadEmails.length < 2) return null;

  const points: SentimentPoint[] = threadEmails
    .map((e) => {
      const analysis = analysesMap[e.id];
      if (!analysis) return null;
      return {
        emailId: e.id,
        from: e.from_name || e.from_address,
        date: e.received_at,
        sentiment: analysis.sentiment as SentimentValue,
        score: getSentimentScore(analysis.sentiment),
      };
    })
    .filter(Boolean) as SentimentPoint[];

  if (points.length < 2) return null;

  const firstHalf = points.slice(0, Math.ceil(points.length / 2));
  const secondHalf = points.slice(Math.ceil(points.length / 2));

  const avgFirst = firstHalf.reduce((s, p) => s + p.score, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((s, p) => s + p.score, 0) / secondHalf.length;

  const diff = avgSecond - avgFirst;
  const direction: SentimentTrend["direction"] =
    diff < -0.3 ? "escalating" : diff > 0.3 ? "improving" : "stable";

  const isEscalating =
    direction === "escalating" ||
    (points[points.length - 1].sentiment === "negative" &&
      points[0].sentiment !== "negative");

  return {
    points,
    direction,
    isEscalating,
    previousSentiment: points[0].sentiment,
    currentSentiment: points[points.length - 1].sentiment,
    messageCount: points.length,
  };
}

export function getEscalatingThreads(
  emails: { id: string; from_name: string; from_address: string; subject: string; received_at: string }[],
  analysesMap: Record<string, EmailAnalysis>
): { threadSubject: string; trend: SentimentTrend; emailIds: string[] }[] {
  const threadGroups = new Map<string, typeof emails>();

  for (const e of emails) {
    const key = normalizeSubject(e.subject);
    if (!threadGroups.has(key)) threadGroups.set(key, []);
    threadGroups.get(key)!.push(e);
  }

  const results: { threadSubject: string; trend: SentimentTrend; emailIds: string[] }[] = [];

  for (const [subject, threadEmails] of threadGroups) {
    if (threadEmails.length < 2) continue;
    const trend = analyzeThreadSentiment(threadEmails, analysesMap);
    if (trend?.isEscalating) {
      results.push({
        threadSubject: threadEmails[0].subject,
        trend,
        emailIds: threadEmails.map((e) => e.id),
      });
    }
  }

  return results;
}

export function getNegativeSentimentCount(
  analysesMap: Record<string, EmailAnalysis>
): number {
  return Object.values(analysesMap).filter(
    (a) => a.sentiment === "negative" || a.sentiment === "urgent"
  ).length;
}
