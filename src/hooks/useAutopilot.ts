import { useState, useCallback, useEffect, useRef } from "react";
import { DraftTone } from "@/services/aiDraftService";
import { Email, EmailAnalysis } from "@/components/inbox/types";

export interface AutopilotDraft {
  emailId: string;
  email: Email;
  analysis: EmailAnalysis;
  draftSubject: string;
  draftBody: string;
  tone: DraftTone;
  status: "pending" | "approved" | "rejected" | "sent";
  rejectionReason?: string;
  createdAt: string;
}

export interface AutopilotPrefs {
  enabled: boolean;
  paused: boolean;
  defaultTone: DraftTone;
  maxUrgency: 1 | 2 | 3;
  excludeCategories: string[];
  autoDraftOnSync: boolean;
  hasSeenExplainer: boolean;
}

const PREFS_KEY = "autopilot-prefs";
const STATS_KEY = "autopilot-stats";

const DEFAULT_PREFS: AutopilotPrefs = {
  enabled: false,
  paused: false,
  defaultTone: "professional",
  maxUrgency: 2,
  excludeCategories: ["legal", "billing", "personal"],
  autoDraftOnSync: true,
  hasSeenExplainer: false,
};

function loadPrefs(): AutopilotPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: AutopilotPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export interface AutopilotStats {
  sentToday: number;
  rejectedToday: number;
  date: string;
}

function loadStats(): AutopilotStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    const stats = raw ? JSON.parse(raw) : null;
    const today = new Date().toISOString().split("T")[0];
    if (stats?.date === today) return stats;
    return { sentToday: 0, rejectedToday: 0, date: today };
  } catch {
    return { sentToday: 0, rejectedToday: 0, date: new Date().toISOString().split("T")[0] };
  }
}

function saveStats(stats: AutopilotStats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function isAutoDraftable(
  email: Email,
  analysis: EmailAnalysis,
  prefs: AutopilotPrefs
): boolean {
  if (analysis.urgency > prefs.maxUrgency) return false;
  if (!analysis.requires_response) return false;
  if (analysis.risk_flags && analysis.risk_flags.length > 0) return false;
  if (prefs.excludeCategories.includes(analysis.category)) return false;
  return true;
}

export function useAutopilot() {
  const [prefs, setPrefs] = useState<AutopilotPrefs>(loadPrefs);
  const [drafts, setDrafts] = useState<Map<string, AutopilotDraft>>(new Map());
  const [stats, setStats] = useState<AutopilotStats>(loadStats);
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);

  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  useEffect(() => {
    saveStats(stats);
  }, [stats]);

  const updatePrefs = useCallback((patch: Partial<AutopilotPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
  }, []);

  const isActive = prefs.enabled && !prefs.paused;

  const pendingDrafts = Array.from(drafts.values()).filter((d) => d.status === "pending");
  const pendingCount = pendingDrafts.length;

  const addDraft = useCallback((draft: AutopilotDraft) => {
    setDrafts((prev) => {
      const next = new Map(prev);
      next.set(draft.emailId, draft);
      return next;
    });
  }, []);

  const updateDraftStatus = useCallback(
    (emailId: string, status: AutopilotDraft["status"], rejectionReason?: string) => {
      setDrafts((prev) => {
        const next = new Map(prev);
        const draft = next.get(emailId);
        if (draft) {
          next.set(emailId, { ...draft, status, rejectionReason });
        }
        return next;
      });
      if (status === "sent") {
        setStats((prev) => ({ ...prev, sentToday: prev.sentToday + 1 }));
      } else if (status === "rejected") {
        setStats((prev) => ({ ...prev, rejectedToday: prev.rejectedToday + 1 }));
      }
    },
    []
  );

  const updateDraftBody = useCallback((emailId: string, body: string) => {
    setDrafts((prev) => {
      const next = new Map(prev);
      const draft = next.get(emailId);
      if (draft) {
        next.set(emailId, { ...draft, draftBody: body });
      }
      return next;
    });
  }, []);

  const clearProcessed = useCallback(() => {
    setDrafts((prev) => {
      const next = new Map(prev);
      for (const [key, draft] of next) {
        if (draft.status !== "pending") next.delete(key);
      }
      return next;
    });
  }, []);

  return {
    prefs,
    updatePrefs,
    drafts,
    pendingDrafts,
    pendingCount,
    addDraft,
    updateDraftStatus,
    updateDraftBody,
    clearProcessed,
    stats,
    processing,
    setProcessing,
    processingRef,
    isActive,
  };
}
