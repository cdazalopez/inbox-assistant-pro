import { create } from "zustand";
import { awsApi } from "@/lib/awsApi";
import { Email, EmailAnalysis } from "@/components/inbox/types";

interface DashboardStats {
  totalEmails: number | null;
  unreadCount: number | null;
  urgentCount: number | null;
  starredCount: number | null;
  requiresResponseCount: number | null;
  categoryCounts: [string, number][] | null;
  allEmails: Email[];
  analysesMap: Record<string, EmailAnalysis> | null;
  lastFetched: number | null;
  isLoading: boolean;
  fetchFailed: boolean;
}

interface DashboardStore extends DashboardStats {
  fetchStats: (userId: string, force?: boolean) => Promise<void>;
  clearCache: () => void;
}

const STALE_MS = 2 * 60 * 1000;

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  totalEmails: null,
  unreadCount: null,
  urgentCount: null,
  starredCount: null,
  requiresResponseCount: null,
  categoryCounts: null,
  allEmails: [],
  analysesMap: null,
  lastFetched: null,
  isLoading: false,
  fetchFailed: false,

  clearCache: () => set({ lastFetched: null }),

  fetchStats: async (userId: string, force = false) => {
    const state = get();
    const allZeros = state.lastFetched && state.totalEmails === 0 && state.unreadCount === 0;
    if (!force && !allZeros && state.lastFetched && Date.now() - state.lastFetched < STALE_MS) {
      return;
    }
    set({ isLoading: true, fetchFailed: false });
    try {
      const [emailsRes, analysesRes] = await Promise.allSettled([
        awsApi.getEmails(userId, 1, 200, "inbox"),
        awsApi.getAllAnalyses(userId),
      ]);

      const updates: Partial<DashboardStats> = { isLoading: false };

      let emails: Email[] = [];
      let total = 0;
      if (emailsRes.status === "fulfilled") {
        emails = emailsRes.value.emails ?? [];
        total = emailsRes.value.total ?? emails.length;
        updates.allEmails = emails;
        updates.unreadCount = emails.filter((e: Email) => !e.is_read).length;
        updates.starredCount = emails.filter((e: Email) => e.is_starred).length;
      }

      let analysesMap: Record<string, EmailAnalysis> = {};
      if (analysesRes.status === "fulfilled") {
        const raw = analysesRes.value;
        if (Array.isArray(raw)) {
          for (const a of raw) {
            if (a.email_id) analysesMap[a.email_id] = a;
          }
        } else if (raw && typeof raw === "object" && !(raw as any).error) {
          analysesMap = raw as Record<string, EmailAnalysis>;
        }
      }

      // Also build from analysis fields already on email objects (from JOIN)
      for (const email of emails) {
        if (!analysesMap[email.id] && (email as any).category) {
          analysesMap[email.id] = {
            email_id: email.id,
            category: (email as any).category,
            urgency: (email as any).urgency ?? 2,
            sentiment: (email as any).sentiment ?? "neutral",
            requires_response: (email as any).requires_response ?? false,
            risk_flags: (email as any).risk_flags ?? [],
            summary: (email as any).summary ?? null,
          } as EmailAnalysis;
        }
      }

      updates.analysesMap = analysesMap;
      const analyses = Object.values(analysesMap);
      updates.urgentCount = analyses.filter((a) => a.urgency >= 4).length;
      updates.requiresResponseCount = analyses.filter((a) => a.requires_response).length;
      const cats: Record<string, number> = {};
      for (const a of analyses) if (a.category) cats[a.category] = (cats[a.category] ?? 0) + 1;
      updates.categoryCounts = Object.entries(cats).sort((a, b) => b[1] - a[1]);

      if (total > 0 || emails.length > 0) {
        updates.totalEmails = total;
        updates.lastFetched = Date.now();
        updates.fetchFailed = false;
      } else {
        updates.fetchFailed = true;
        updates.totalEmails = null;
        updates.unreadCount = null;
        setTimeout(() => {
          const s = get();
          if (s.fetchFailed) s.fetchStats(userId, true);
        }, 5000);
      }

      set(updates);
    } catch {
      set({ isLoading: false, fetchFailed: true });
      setTimeout(() => {
        const s = get();
        if (s.fetchFailed) s.fetchStats(userId, true);
      }, 5000);
    }
  },
}));
