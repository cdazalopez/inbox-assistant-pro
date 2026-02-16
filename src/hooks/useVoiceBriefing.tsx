import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, ReactNode } from "react";
import { BriefingContent } from "@/services/briefingService";
import { format } from "date-fns";

export interface VoicePreferences {
  voiceURI: string | null;
  speed: number;
  autoPlay: boolean;
}

const VOICE_PREFS_KEY = "voice_briefing_prefs";

function loadVoicePrefs(): VoicePreferences {
  try {
    const raw = localStorage.getItem(VOICE_PREFS_KEY);
    if (!raw) return { voiceURI: null, speed: 0.9, autoPlay: false };
    return { voiceURI: null, speed: 0.9, autoPlay: false, ...JSON.parse(raw) };
  } catch {
    return { voiceURI: null, speed: 0.9, autoPlay: false };
  }
}

export function saveVoicePrefs(prefs: VoicePreferences) {
  localStorage.setItem(VOICE_PREFS_KEY, JSON.stringify(prefs));
}

function buildScript(content: BriefingContent, dateStr?: string): string {
  const c = typeof content === "string" ? JSON.parse(content) as BriefingContent : content;
  const dateLabel = dateStr
    ? format(new Date(dateStr + "T12:00:00"), "EEEE, MMMM d")
    : format(new Date(), "EEEE, MMMM d");

  const parts: string[] = [];
  parts.push(`Good morning. Here's your inbox briefing for ${dateLabel}.`);

  if (c.summary) parts.push(c.summary);

  const urgent = c.stats?.urgent_count ?? 0;
  const pending = c.stats?.requires_response_count ?? 0;
  parts.push(`You have ${urgent} urgent item${urgent !== 1 ? "s" : ""} and ${pending} pending item${pending !== 1 ? "s" : ""}.`);

  if (c.urgent_items?.length > 0) {
    parts.push("Your urgent items are:");
    c.urgent_items.forEach((item) => {
      parts.push(`${item.subject} from ${item.from}. ${item.reason}.`);
    });
  }

  if (c.action_items?.length > 0) {
    parts.push("Your action items for today are:");
    c.action_items.forEach((item) => parts.push(item));
  }

  parts.push("That's your briefing. Have a productive day.");
  return parts.join(" ");
}

type PlaybackState = "idle" | "playing" | "paused";

interface VoiceBriefingContextValue {
  state: PlaybackState;
  progress: number; // 0-100
  play: (content: BriefingContent, dateStr?: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  voicePrefs: VoicePreferences;
  updateVoicePrefs: (p: Partial<VoicePreferences>) => void;
}

const VoiceBriefingContext = createContext<VoiceBriefingContextValue | null>(null);

export function VoiceBriefingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlaybackState>("idle");
  const [progress, setProgress] = useState(0);
  const [voicePrefs, setVoicePrefs] = useState<VoicePreferences>(loadVoicePrefs);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scriptLenRef = useRef(0);

  const clearInterval_ = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const updateVoicePrefs = useCallback((partial: Partial<VoicePreferences>) => {
    setVoicePrefs((prev) => {
      const next = { ...prev, ...partial };
      saveVoicePrefs(next);
      return next;
    });
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setState("idle");
    setProgress(0);
    clearInterval_();
    utteranceRef.current = null;
  }, []);

  const play = useCallback((content: BriefingContent, dateStr?: string) => {
    stop();
    const script = buildScript(content, dateStr);
    scriptLenRef.current = script.length;

    const utterance = new SpeechSynthesisUtterance(script);
    utterance.rate = voicePrefs.speed;

    if (voicePrefs.voiceURI) {
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find((v) => v.voiceURI === voicePrefs.voiceURI);
      if (voice) utterance.voice = voice;
    }

    utterance.onend = () => {
      setState("idle");
      setProgress(100);
      clearInterval_();
      setTimeout(() => setProgress(0), 1000);
    };
    utterance.onerror = () => {
      setState("idle");
      setProgress(0);
      clearInterval_();
    };

    // Track progress via boundary events
    utterance.onboundary = (e) => {
      if (scriptLenRef.current > 0) {
        setProgress(Math.min(100, Math.round((e.charIndex / scriptLenRef.current) * 100)));
      }
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setState("playing");
  }, [voicePrefs.speed, voicePrefs.voiceURI, stop]);

  const pause = useCallback(() => {
    window.speechSynthesis.pause();
    setState("paused");
  }, []);

  const resume = useCallback(() => {
    window.speechSynthesis.resume();
    setState("playing");
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      clearInterval_();
    };
  }, []);

  return (
    <VoiceBriefingContext.Provider value={{ state, progress, play, pause, resume, stop, voicePrefs, updateVoicePrefs }}>
      {children}
    </VoiceBriefingContext.Provider>
  );
}

const noopPrefs: VoicePreferences = { voiceURI: null, speed: 0.9, autoPlay: false };
const fallback: VoiceBriefingContextValue = {
  state: "idle",
  progress: 0,
  play: () => {},
  pause: () => {},
  resume: () => {},
  stop: () => {},
  voicePrefs: noopPrefs,
  updateVoicePrefs: () => {},
};

export function useVoiceBriefing() {
  const ctx = useContext(VoiceBriefingContext);
  return ctx ?? fallback;
}
