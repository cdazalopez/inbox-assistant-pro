import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailAnalysis } from "@/components/inbox/types";
import RiskFlagBadges from "./RiskFlagBadges";

interface AlertEmail {
  id: string;
  subject: string;
  received_at: string;
  analysis: EmailAnalysis;
}

interface AlertBellProps {
  urgentEmails: AlertEmail[];
}

export default function AlertBell({ urgentEmails }: AlertBellProps) {
  const [open, setOpen] = useState(false);
  const [seenIds, setSeenIds] = useState<Set<string>>(() => {
    try {
      const raw = sessionStorage.getItem("seen_alert_ids");
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const unseenCount = urgentEmails.filter((e) => !seenIds.has(e.id)).length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllSeen = () => {
    const allIds = new Set(urgentEmails.map((e) => e.id));
    setSeenIds(allIds);
    sessionStorage.setItem("seen_alert_ids", JSON.stringify([...allIds]));
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {unseenCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unseenCount > 99 ? "99+" : unseenCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border bg-card shadow-xl">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Urgent Emails</h3>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-border">
            {urgentEmails.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No urgent emails 🎉
              </div>
            ) : (
              urgentEmails.map((item) => {
                const isCritical = item.analysis.urgency >= 5 || item.analysis.risk_flags?.includes("legal_threat");
                return (
                  <button
                    key={item.id}
                    className="flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                    onClick={() => {
                      navigate("/inbox");
                      setOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 shrink-0 rounded-full ${isCritical ? "bg-red-500" : "bg-orange-500"}`} />
                      <span className="truncate text-sm font-medium text-foreground">
                        {item.subject || "(No subject)"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 pl-4">
                      <RiskFlagBadges flags={item.analysis.risk_flags ?? []} size="sm" />
                      <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                        {formatTime(item.received_at)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          {urgentEmails.length > 0 && (
            <div className="border-t border-border px-4 py-2">
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={markAllSeen}>
                Mark all as seen
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
