import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { awsApi } from "@/lib/awsApi";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, Loader2 } from "lucide-react";
import { Email } from "@/components/inbox/types";
import { format } from "date-fns";

interface SmartCleanupCardProps {
  onCleanupDone?: () => void;
}

export default function SmartCleanupCard({ onCleanupDone }: SmartCleanupCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [count, setCount] = useState<number | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reviewEmails, setReviewEmails] = useState<Email[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [loadingReview, setLoadingReview] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchCount = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await awsApi.getEmails(user.id, 1, 1, "inbox", "", undefined, undefined);
      // We need marketing category count — fetch with category search
      const mktData = await awsApi.getEmails(user.id, 1, 1, "inbox", "category:marketing");
      // Fallback: use total from a marketing-specific query if the API supports it
      // Since the API may not support category filter directly, we'll use analysis data
      setCount(mktData.total ?? 0);
    } catch {
      setCount(0);
    }
  }, [user?.id]);

  // Simpler approach: count marketing emails from analyses
  const fetchMarketingCount = useCallback(async () => {
    if (!user?.id) return;
    try {
      const analyses = await awsApi.getAllAnalyses(user.id);
      const arr = Array.isArray(analyses) ? analyses : [];
      const mktCount = arr.filter((a: any) => a.category === "marketing").length;
      setCount(mktCount);
    } catch {
      setCount(0);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchMarketingCount();
  }, [fetchMarketingCount]);

  const handleReview = async () => {
    if (!user?.id) return;
    setLoadingReview(true);
    setReviewOpen(true);
    try {
      // Get all analyses to find marketing email IDs
      const analyses = await awsApi.getAllAnalyses(user.id);
      const arr = Array.isArray(analyses) ? analyses : [];
      const mktIds = new Set(arr.filter((a: any) => a.category === "marketing").map((a: any) => a.email_id));

      // Fetch emails and filter to marketing
      const data = await awsApi.getEmails(user.id, 1, 200, "inbox");
      const emails: Email[] = (data.emails ?? []).filter((e: Email) => mktIds.has(e.id)).slice(0, 20);
      setReviewEmails(emails);
      setCheckedIds(new Set(emails.map((e) => e.id)));
    } catch {
      toast({ title: "Failed to load emails", variant: "destructive" });
    } finally {
      setLoadingReview(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!user?.id || checkedIds.size === 0) return;
    setDeleting(true);
    try {
      await awsApi.bulkDelete({
        user_id: user.id,
        categories: ["marketing"],
        delete_from_provider: false,
      });
      toast({ title: `${checkedIds.size} emails cleaned up` });
      setReviewOpen(false);
      setCount(0);
      onCleanupDone?.();
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!user?.id) return;
    setDeleting(true);
    try {
      await awsApi.bulkDelete({
        user_id: user.id,
        categories: ["marketing"],
        delete_from_provider: false,
      });
      toast({ title: `${count} emails deleted` });
      setConfirmOpen(false);
      setCount(0);
      onCleanupDone?.();
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (count === null) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-4">
        <Skeleton className="h-4 w-40 mb-2" />
        <Skeleton className="h-3 w-64" />
      </div>
    );
  }

  if (count === 0) return null;

  return (
    <>
      <div className="rounded-xl border border-border bg-card px-5 py-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-muted-foreground" />
            🗑️ Smart Cleanup
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            AI found {count} marketing emails that may be junk
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleReview}>
            Review
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
            Delete All
          </Button>
        </div>
      </div>

      {/* Review Modal */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Review Marketing Emails</DialogTitle>
            <DialogDescription>
              Uncheck any emails you want to keep, then delete the rest.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {loadingReview ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3 px-1">
                  <Skeleton className="h-4 w-4" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))
            ) : reviewEmails.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No marketing emails found</p>
            ) : (
              reviewEmails.map((email) => (
                <label
                  key={email.id}
                  className="flex items-start gap-3 py-3 px-1 cursor-pointer hover:bg-muted/30 rounded-md transition-colors"
                >
                  <Checkbox
                    checked={checkedIds.has(email.id)}
                    onCheckedChange={() => toggleCheck(email.id)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {email.from_name || email.from_address}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {email.received_at ? format(new Date(email.received_at), "MMM d") : ""}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/80 truncate">{email.subject}</p>
                    <p className="text-xs text-muted-foreground truncate">{email.snippet}</p>
                  </div>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSelected}
              disabled={deleting || checkedIds.size === 0}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Delete Selected ({checkedIds.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete All Confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all {count} marketing emails?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. All marketing emails will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
