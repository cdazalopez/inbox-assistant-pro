export interface ThreadSummary {
  timeline: { date: string; from: string; action: string }[];
  decisions: string[];
  pending: string[];
  key_points: string[];
  participants: { name: string; email: string; message_count: number }[];
}

export interface CachedThreadSummary {
  summary: ThreadSummary;
  generated_at: string;
  thread_key: string;
}

const CACHE_PREFIX = "thread_summary_";

export function getCachedSummary(threadKey: string): CachedThreadSummary | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + threadKey);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function cacheSummary(threadKey: string, summary: ThreadSummary): CachedThreadSummary {
  const cached: CachedThreadSummary = {
    summary,
    generated_at: new Date().toISOString(),
    thread_key: threadKey,
  };
  localStorage.setItem(CACHE_PREFIX + threadKey, JSON.stringify(cached));
  return cached;
}

export function clearCachedSummary(threadKey: string) {
  localStorage.removeItem(CACHE_PREFIX + threadKey);
}

/**
 * Normalize a subject line to find thread matches.
 * Strips Re:, Fwd:, Fw: prefixes and whitespace.
 */
export function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(re|fwd|fw)\s*:\s*/gi, "")
    .replace(/^(re|fwd|fw)\s*:\s*/gi, "") // double strip for "Re: Re:"
    .trim()
    .toLowerCase();
}
