import { useState, useEffect, useCallback } from "react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { Clock, Trash2, Edit2, Undo2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { awsApi } from "@/lib/awsApi";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import SnoozeDropdown from "./SnoozeDropdown";

interface SnoozedEmail {
  id: string;
  email_id: string;
  wake_at: string;
  reason: string;
  context_note?: string;
  status: string;
  created_at: string;
  email_subject?: string;
  email_from?: string;
  email_from_name?: string;
  email_snippet?: string;
}

export default function SnoozedListView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<SnoozedEmail[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSnoozed = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await awsApi.getSnoozedEmails(user.id);
      setItems(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Failed to load snoozed emails", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    fetchSnoozed();
  }, [fetchSnoozed]);

  const handleUnsnooze = async (item: SnoozedEmail) => {
    try {
      await awsApi.deleteSnooze(item.id, user!.id);
      setItems((prev) => prev.filter((s) => s.id !== item.id));
      toast({ title: "Email unsnoozed and moved back to inbox" });
    } catch {
      toast({ title: "Failed to unsnooze", variant: "destructive" });
    }
  };

  const handleResnooze = async (item: SnoozedEmail, wakeAt: string, reason: string, contextNote?: string) => {
    try {
      await awsApi.updateSnooze({
        snooze_id: item.id,
        user_id: user!.id,
        wake_at: wakeAt,
        reason,
        context_note: contextNote,
      });
      setItems((prev) =>
        prev.map((s) =>
          s.id === item.id ? { ...s, wake_at: wakeAt, reason, context_note: contextNote } : s
        )
      );
      toast({ title: `⏰ Updated to wake at ${format(new Date(wakeAt), "MMM d, h:mm a")}` });
    } catch {
      toast({ title: "Failed to update snooze", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg p-3">
            <Skeleton className="h-4 w-4" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="text-center">
          <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No snoozed emails</p>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {items.map((item) => {
        const wakeDate = new Date(item.wake_at);
        const isDue = isPast(wakeDate);

        return (
          <div
            key={item.id}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
          >
            <Clock className={`h-4 w-4 shrink-0 ${isDue ? "text-orange-400" : "text-muted-foreground"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {item.email_subject || "No subject"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {item.email_from_name || item.email_from || "Unknown"}
              </p>
              {item.context_note && (
                <p className="text-xs text-primary/70 mt-0.5 truncate">
                  📝 {item.context_note}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className={`text-xs font-medium ${isDue ? "text-orange-400" : "text-muted-foreground"}`}>
                {isDue
                  ? "Due now"
                  : `Wakes ${formatDistanceToNow(wakeDate, { addSuffix: true })}`}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {format(wakeDate, "MMM d, h:mm a")}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleUnsnooze(item)}
                title="Unsnooze"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <SnoozeDropdown
                onSnooze={(wakeAt, reason, note) => handleResnooze(item, wakeAt, reason, note)}
                compact
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
