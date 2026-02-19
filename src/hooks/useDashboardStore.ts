import { create } from "zustand";
import { awsApi } from "@/lib/awsApi";
import { EmailAnalysis } from "@/components/inbox/types";

interface DashboardStats {
  totalEmails: number | null;
  unreadCount: number | null;
  urgentCount: number | null;
  starredCount: number | null;
  requiresResponseCount: number | null;
  categoryCounts: [string, number][] | null;
  lastFetched: number | null;
  isLoading: boolean;
}

interface DashboardStore extends DashboardStats {
  fetchStats: (userId: string, force?: boolean) => Promise<void>;
}

const STALE_MS = 2 * 60 * 1000; // 2 minutes

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  totalEmails: null,
  unreadCount: null,
  urgentCount: null,
  starredCount: null,
  requiresResponseCount: null,
  categoryCounts: null,
  lastFetched: null,
  isLoading: false,

  fetchStats: async (userId: string, force = false) => {
    const state = get();
    if (!force && state.lastFetched && Date.now() - state.lastFetched < STALE_MS) {
      return; // data is still fresh
    }
    set({ isLoading: true });
    try {
      const [totalRes, unreadRes, analysesRes] = await Promise.allSettled([
        awsApi.getEmails(userId, 1, 1, "inbox"),
        awsApi.getEmails(userId, 1, 1, "unread"),
        awsApi.getAllAnalyses(userId),
      ]);

      const updates: Partial<DashboardStats> = { lastFetched: Date.now(), isLoading: false };

      if (totalRes.status === "fulfilled") updates.totalEmails = totalRes.value.total ?? 0;
      if (unreadRes.status === "fulfilled") updates.unreadCount = unreadRes.value.total ?? 0;

      if (analysesRes.status === "fulfilled") {
        const raw = analysesRes.value;
        let map: Record<string, EmailAnalysis> = {};
        if (Array.isArray(raw)) {
          for (const a of raw) { if (a.email_id) map[a.email_id] = a; }
        } else if (raw && typeof raw === "object") {
          map = raw as Record<string, EmailAnalysis>;
        }
        const analyses = Object.values(map);
        updates.urgentCount = analyses.filter((a) => a.urgency >= 4).length;
        updates.requiresResponseCount = analyses.filter((a) => a.requires_response).length;

        const cats: Record<string, number> = {};
        for (const a of analyses) cats[a.category] = (cats[a.category] ?? 0) + 1;
        updates.categoryCounts = Object.entries(cats).sort((a, b) => b[1] - a[1]);
      }

      set(updates);
    } catch {
      set({ isLoading: false });
    }
  },
}));
