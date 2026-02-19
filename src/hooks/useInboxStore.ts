import { create } from "zustand";
import { Email, EmailAnalysis } from "@/components/inbox/types";

const STALE_MS = 2 * 60 * 1000; // 2 minutes

interface InboxStore {
  emails: Email[];
  analysesMap: Record<string, EmailAnalysis>;
  total: number;
  lastFetched: number | null;
  setEmails: (emails: Email[], total: number) => void;
  appendEmails: (emails: Email[]) => void;
  setAnalysesMap: (map: Record<string, EmailAnalysis>) => void;
  mergeAnalyses: (partial: Record<string, EmailAnalysis>) => void;
  updateEmail: (id: string, updates: Partial<Email>) => void;
  removeEmail: (id: string) => void;
  isStale: () => boolean;
}

export const useInboxStore = create<InboxStore>((set, get) => ({
  emails: [],
  analysesMap: {},
  total: 0,
  lastFetched: null,

  setEmails: (emails, total) => set({ emails, total, lastFetched: Date.now() }),
  appendEmails: (newEmails) => set((s) => ({ emails: [...s.emails, ...newEmails] })),
  setAnalysesMap: (map) => set({ analysesMap: map }),
  mergeAnalyses: (partial) => set((s) => ({ analysesMap: { ...s.analysesMap, ...partial } })),
  updateEmail: (id, updates) => set((s) => ({
    emails: s.emails.map((e) => (e.id === id ? { ...e, ...updates } : e)),
  })),
  removeEmail: (id) => set((s) => ({
    emails: s.emails.filter((e) => e.id !== id),
    total: Math.max(0, s.total - 1),
  })),
  isStale: () => {
    const { lastFetched } = get();
    return !lastFetched || Date.now() - lastFetched > STALE_MS;
  },
}));
