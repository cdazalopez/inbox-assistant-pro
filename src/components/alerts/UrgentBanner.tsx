import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailAnalysis } from "@/components/inbox/types";

interface UrgentBannerProps {
  analysesMap: Record<string, EmailAnalysis>;
  unreadEmailIds: Set<string>;
  onFilterUrgent: () => void;
}

export default function UrgentBanner({ analysesMap, unreadEmailIds, onFilterUrgent }: UrgentBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  let criticalCount = 0;
  let highCount = 0;

  for (const [emailId, analysis] of Object.entries(analysesMap)) {
    if (!unreadEmailIds.has(emailId)) continue;
    const hasLegalThreat = analysis.risk_flags?.includes("legal_threat");
    if (analysis.urgency >= 5 || hasLegalThreat) {
      criticalCount++;
    } else if (analysis.urgency >= 4 || (analysis.risk_flags?.length > 0)) {
      highCount++;
    }
  }

  const totalUrgent = criticalCount + highCount;
  if (totalUrgent === 0) return null;

  const isCritical = criticalCount > 0;
  const bgClass = isCritical
    ? "bg-red-500/15 border-red-500/30 text-red-400"
    : "bg-orange-500/15 border-orange-500/30 text-orange-400";

  return (
    <div className={`flex items-center gap-3 border-b px-4 py-2.5 ${bgClass}`}>
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <button onClick={onFilterUrgent} className="flex-1 text-left text-sm font-medium hover:underline">
        You have {totalUrgent} urgent email{totalUrgent !== 1 ? "s" : ""} requiring attention
        {criticalCount > 0 && ` (${criticalCount} critical)`}
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 hover:bg-transparent"
        onClick={() => setDismissed(true)}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
