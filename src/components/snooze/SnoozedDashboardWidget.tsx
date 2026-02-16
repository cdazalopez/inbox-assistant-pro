import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { awsApi } from "@/lib/awsApi";
import { useAuth } from "@/hooks/useAuth";
import { isToday } from "date-fns";

export default function SnoozedDashboardWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [snoozedCount, setSnoozedCount] = useState<number | null>(null);
  const [returningToday, setReturningToday] = useState<number | null>(null);

  const fetchCounts = useCallback(async () => {
    if (!user?.id) return;
    try {
      const snoozed = await awsApi.getSnoozedEmails(user.id);
      const list = Array.isArray(snoozed) ? snoozed : [];
      setSnoozedCount(list.length);
      setReturningToday(
        list.filter((s: any) => {
          const wake = new Date(s.wake_at);
          return isToday(wake);
        }).length
      );
    } catch {
      setSnoozedCount(0);
      setReturningToday(0);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Snoozed</h2>
        </div>
      </div>
      <div className="px-5 py-4">
        {snoozedCount === null ? (
          <Skeleton className="h-5 w-32" />
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-foreground">
              <span className="font-semibold">{snoozedCount}</span>{" "}
              <span className="text-muted-foreground">snoozed</span>
              {returningToday !== null && returningToday > 0 && (
                <>
                  {" · "}
                  <span className="font-semibold text-orange-400">{returningToday}</span>{" "}
                  <span className="text-muted-foreground">returning today</span>
                </>
              )}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => navigate("/inbox?filter=snoozed")}
            >
              View Snoozed Emails
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
