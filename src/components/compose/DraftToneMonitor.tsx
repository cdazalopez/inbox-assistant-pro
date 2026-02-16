import { useState, useEffect, useRef } from "react";
import { AlertTriangle, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Words/phrases that signal aggressive or hostile tone
const AGGRESSIVE_PATTERNS = [
  /\b(unacceptable|ridiculous|incompetent|pathetic|disgraceful|outrageous|inexcusable)\b/gi,
  /\b(demand|insist|threaten|sue|lawsuit|attorney|lawyer|legal action)\b/gi,
  /\b(immediately|right now|last warning|final notice)\b/gi,
  /\b(worst|terrible|horrible|awful|useless|stupid|idiot)\b/gi,
  /\b(never again|fed up|sick of|tired of|done with)\b/gi,
  /!!+/g,
  /\bALL CAPS [A-Z]{4,}\b/g,
];

const PASSIVE_AGGRESSIVE_PATTERNS = [
  /\b(as per my (last|previous) email)\b/gi,
  /\b(as I('ve| have) (already|previously) (mentioned|stated|said))\b/gi,
  /\b(per our conversation)\b/gi,
  /\b(just to clarify|let me be clear)\b/gi,
  /\b(going forward|moving forward),? I expect\b/gi,
];

interface ToneWarning {
  level: "caution" | "warning";
  message: string;
  matches: string[];
}

function analyzeDraftTone(text: string): ToneWarning | null {
  if (!text || text.length < 20) return null;

  const plainText = text.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ");

  const aggressiveMatches: string[] = [];
  for (const pattern of AGGRESSIVE_PATTERNS) {
    const matches = plainText.match(pattern);
    if (matches) aggressiveMatches.push(...matches.map((m) => m.trim()));
  }

  const passiveMatches: string[] = [];
  for (const pattern of PASSIVE_AGGRESSIVE_PATTERNS) {
    const matches = plainText.match(pattern);
    if (matches) passiveMatches.push(...matches.map((m) => m.trim()));
  }

  // Check for excessive caps (more than 30% of alpha chars)
  const alphaChars = plainText.replace(/[^a-zA-Z]/g, "");
  const upperChars = plainText.replace(/[^A-Z]/g, "");
  const capsRatio = alphaChars.length > 10 ? upperChars.length / alphaChars.length : 0;
  if (capsRatio > 0.4) {
    aggressiveMatches.push("excessive capitalization");
  }

  // Check for multiple exclamation marks
  const exclamationCount = (plainText.match(/!/g) || []).length;
  if (exclamationCount >= 3) {
    aggressiveMatches.push("multiple exclamation marks");
  }

  if (aggressiveMatches.length >= 2) {
    return {
      level: "warning",
      message:
        "Your draft may sound aggressive. In healthcare communication, consider softening your tone to maintain professional relationships.",
      matches: [...new Set(aggressiveMatches)].slice(0, 4),
    };
  }

  if (aggressiveMatches.length === 1 || passiveMatches.length > 0) {
    const allMatches = [...new Set([...aggressiveMatches, ...passiveMatches])].slice(0, 3);
    return {
      level: "caution",
      message:
        "Your draft's tone could be perceived as confrontational. Consider rephrasing for a more constructive approach.",
      matches: allMatches,
    };
  }

  return null;
}

interface DraftToneMonitorProps {
  bodyRef: React.RefObject<HTMLDivElement>;
}

export default function DraftToneMonitor({ bodyRef }: DraftToneMonitorProps) {
  const [warning, setWarning] = useState<ToneWarning | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const checkTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    const handleInput = () => {
      setDismissed(false);
      clearTimeout(checkTimer.current);
      checkTimer.current = setTimeout(() => {
        const html = el.innerHTML ?? "";
        setWarning(analyzeDraftTone(html));
      }, 800);
    };

    el.addEventListener("input", handleInput);
    return () => {
      el.removeEventListener("input", handleInput);
      clearTimeout(checkTimer.current);
    };
  }, [bodyRef]);

  if (!warning || dismissed) return null;

  const isWarning = warning.level === "warning";
  const borderColor = isWarning ? "border-red-500/30" : "border-yellow-500/20";
  const bgColor = isWarning ? "bg-red-500/5" : "bg-yellow-500/5";
  const iconColor = isWarning ? "text-red-400" : "text-yellow-400";
  const textColor = isWarning ? "text-red-300/90" : "text-yellow-300/90";

  return (
    <div className={`mx-4 mb-2 flex items-start gap-2 rounded-md border ${borderColor} ${bgColor} p-2.5`}>
      {isWarning ? (
        <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} />
      ) : (
        <Shield className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} />
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-xs ${textColor}`}>{warning.message}</p>
        {warning.matches.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {warning.matches.map((m, i) => (
              <span
                key={i}
                className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  isWarning
                    ? "bg-red-500/15 text-red-400"
                    : "bg-yellow-500/15 text-yellow-400"
                }`}
              >
                "{m}"
              </span>
            ))}
          </div>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 shrink-0"
        onClick={() => setDismissed(true)}
      >
        <X className="h-3 w-3 text-muted-foreground" />
      </Button>
    </div>
  );
}
