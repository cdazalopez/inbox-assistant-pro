import { useState } from "react";
import { format } from "date-fns";
import { Clock, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { awsApi } from "@/lib/awsApi";
import { useToast } from "@/hooks/use-toast";
import SnoozeDropdown from "./SnoozeDropdown";

interface SnoozedItem {
  id: string;
  email_id: string;
  wake_at: string;
  reason: string;
  context_note?: string;
  email_subject?: string;
  email_from?: string;
  email_from_name?: string;
}

interface SnoozedWakeUpBannerProps {
  dueItems: SnoozedItem[];
  userId: string;
  onDismiss: (snoozeId: string) => void;
  onOpenEmail: (emailId: string) => void;
}

export default function SnoozedWakeUpBanner({
  dueItems,
  userId,
  onDismiss,
  onOpenEmail,
}: SnoozedWakeUpBannerProps) {
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  if (dueItems.length === 0) return null;

  const visible = dueItems.filter((d) => !dismissed.has(d.id));
  if (visible.length === 0) return null;

  const handleOpen = async (item: SnoozedItem) => {
    try {
      await awsApi.updateSnooze({ snooze_id: item.id, user_id: userId, status: "unsnoozed" });
      onOpenEmail(item.email_id);
      setDismissed((p) => new Set([...p, item.id]));
    } catch {
      toast({ title: "Failed to unsnooze", variant: "destructive" });
    }
  };

  const handleDismissItem = (snoozeId: string) => {
    setDismissed((p) => new Set([...p, snoozeId]));
    onDismiss(snoozeId);
  };

  const handleResnooze = async (item: SnoozedItem, wakeAt: string, reason: string, contextNote?: string) => {
    try {
      await awsApi.updateSnooze({
        snooze_id: item.id,
        user_id: userId,
        wake_at: wakeAt,
        reason,
        context_note: contextNote,
        status: "snoozed",
      });
      setDismissed((p) => new Set([...p, item.id]));
      toast({ title: `⏰ Re-snoozed until ${format(new Date(wakeAt), "MMM d, h:mm a")}` });
    } catch {
      toast({ title: "Failed to re-snooze", variant: "destructive" });
    }
  };

  return (
    <div className="border-b border-orange-500/30 bg-orange-500/5 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="h-4 w-4 text-orange-400" />
        <span className="text-sm font-semibold text-orange-400">
          ⏰ {visible.length} snoozed email{visible.length !== 1 ? "s" : ""} {visible.length !== 1 ? "are" : "is"} back!
        </span>
      </div>
      <div className="space-y-2">
        {visible.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {item.email_subject || "No subject"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                From: {item.email_from_name || item.email_from || "Unknown"}
              </p>
              {item.context_note && (
                <p className="text-xs text-orange-400 mt-1">
                  You wanted to: {item.context_note}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button size="sm" variant="outline" onClick={() => handleOpen(item)}>
                Open
              </Button>
              <SnoozeDropdown
                onSnooze={(wakeAt, reason, note) => handleResnooze(item, wakeAt, reason, note)}
                compact
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDismissItem(item.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
