import { useState, useCallback } from "react";
import { AutopilotDraft, AutopilotStats } from "@/hooks/useAutopilot";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { awsApi } from "@/lib/awsApi";
import ComposeModal from "@/components/ComposeModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bot,
  Check,
  Pencil,
  X,
  Send,
  ShieldCheck,
  Clock,
  TrendingUp,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface AutopilotQueueProps {
  pendingDrafts: AutopilotDraft[];
  stats: AutopilotStats;
  onApprove: (emailId: string) => void;
  onReject: (emailId: string, reason?: string) => void;
  onUpdateBody: (emailId: string, body: string) => void;
  accountId: string | null;
}

function DraftCard({
  draft,
  onApprove,
  onReject,
  onEdit,
  sending,
}: {
  draft: AutopilotDraft;
  onApprove: () => void;
  onReject: (reason?: string) => void;
  onEdit: () => void;
  sending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState<string>("");

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      {/* Original email header */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">
              {draft.email.from_name || draft.email.from_address}
            </span>
            <Badge variant="outline" className="text-[10px] shrink-0">
              {draft.analysis.category}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">{draft.email.subject}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {expanded && (
        <p className="text-xs text-muted-foreground bg-muted/30 rounded-md p-2">
          {draft.email.snippet}
        </p>
      )}

      {/* AI Draft */}
      <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Bot className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">AI Draft Reply</span>
          <Badge variant="outline" className="text-[10px] ml-auto">
            {draft.tone}
          </Badge>
        </div>
        <div
          className="text-sm text-foreground/80 max-h-24 overflow-y-auto"
          dangerouslySetInnerHTML={{ __html: draft.draftBody }}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="gap-1.5"
          onClick={onApprove}
          disabled={sending}
        >
          {sending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Approve & Send
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
        {showReject ? (
          <div className="flex items-center gap-1.5 ml-auto">
            <Select value={rejectReason} onValueChange={setRejectReason}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Reason (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="wrong_tone">Wrong tone</SelectItem>
                <SelectItem value="not_needed">Not needed</SelectItem>
                <SelectItem value="handle_manually">I'll handle manually</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="destructive"
              size="sm"
              className="h-8"
              onClick={() => {
                onReject(rejectReason || undefined);
                setShowReject(false);
              }}
            >
              Reject
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-destructive ml-auto"
            onClick={() => setShowReject(true)}
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </Button>
        )}
      </div>
    </div>
  );
}

export default function AutopilotQueue({
  pendingDrafts,
  stats,
  onApprove,
  onReject,
  onUpdateBody,
  accountId,
}: AutopilotQueueProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const [showApproveAll, setShowApproveAll] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [editingDraft, setEditingDraft] = useState<AutopilotDraft | null>(null);

  const handleApprove = useCallback(
    async (emailId: string) => {
      if (!user?.id || !accountId) {
        toast({ title: "No email account connected", variant: "destructive" });
        return;
      }
      const draft = pendingDrafts.find((d) => d.emailId === emailId);
      if (!draft) return;

      setSendingIds((prev) => new Set(prev).add(emailId));
      try {
        await awsApi.sendEmail({
          user_id: user.id,
          account_id: accountId,
          to: [{ email: draft.email.from_address, name: draft.email.from_name }],
          subject: draft.draftSubject,
          body: draft.draftBody,
          reply_to_message_id: draft.email.nylas_id,
        });
        onApprove(emailId);
        toast({ title: `✓ Reply sent to ${draft.email.from_name || draft.email.from_address}` });
      } catch {
        toast({ title: "Failed to send", variant: "destructive" });
      } finally {
        setSendingIds((prev) => {
          const next = new Set(prev);
          next.delete(emailId);
          return next;
        });
      }
    },
    [user?.id, accountId, pendingDrafts, onApprove, toast]
  );

  const handleApproveAll = useCallback(async () => {
    setApprovingAll(true);
    for (const draft of pendingDrafts) {
      await handleApprove(draft.emailId);
    }
    setApprovingAll(false);
    setShowApproveAll(false);
  }, [pendingDrafts, handleApprove]);

  const timeSaved = stats.sentToday * 3;

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Autopilot Queue</h2>
        </div>
        {pendingDrafts.length > 1 && (
          <Button
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setShowApproveAll(true)}
          >
            <Send className="h-3.5 w-3.5" />
            Approve All ({pendingDrafts.length})
          </Button>
        )}
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 border-b border-border px-5 py-2.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {pendingDrafts.length} pending
        </span>
        <span className="flex items-center gap-1">
          <Check className="h-3 w-3 text-emerald-400" />
          {stats.sentToday} sent today
        </span>
        <span className="flex items-center gap-1">
          <X className="h-3 w-3 text-red-400" />
          {stats.rejectedToday} rejected
        </span>
        {stats.sentToday > 0 && (
          <span className="flex items-center gap-1 ml-auto">
            <TrendingUp className="h-3 w-3 text-primary" />
            ~{timeSaved} min saved
          </span>
        )}
      </div>

      {/* Safety message */}
      <div className="flex items-center gap-2 px-5 py-2 bg-emerald-500/5 border-b border-border">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
        <span className="text-[11px] text-emerald-400/80">
          Nothing sends without your approval
        </span>
      </div>

      {/* Draft cards */}
      <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
        {pendingDrafts.length === 0 ? (
          <div className="text-center py-8">
            <Bot className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No drafts pending review</p>
            <p className="text-xs text-muted-foreground mt-1">
              Autopilot will generate drafts when new qualifying emails arrive
            </p>
          </div>
        ) : (
          pendingDrafts.map((draft) => (
            <DraftCard
              key={draft.emailId}
              draft={draft}
              onApprove={() => handleApprove(draft.emailId)}
              onReject={(reason) => onReject(draft.emailId, reason)}
              onEdit={() => setEditingDraft(draft)}
              sending={sendingIds.has(draft.emailId)}
            />
          ))
        )}
      </div>

      {/* Approve All Confirmation */}
      <Dialog open={showApproveAll} onOpenChange={setShowApproveAll}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Send {pendingDrafts.length} emails?</DialogTitle>
            <DialogDescription>
              This will send all {pendingDrafts.length} pending AI-drafted replies. Make sure
              you've reviewed each draft.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveAll(false)}>
              Cancel
            </Button>
            <Button onClick={handleApproveAll} disabled={approvingAll}>
              {approvingAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit in Compose Modal */}
      {editingDraft && (
        <ComposeModal
          open={!!editingDraft}
          onClose={() => setEditingDraft(null)}
          replyTo={{
            id: editingDraft.email.id,
            nylas_id: editingDraft.email.nylas_id,
            from_name: editingDraft.email.from_name,
            from_address: editingDraft.email.from_address,
            subject: editingDraft.email.subject,
            snippet: editingDraft.email.snippet,
            received_at: editingDraft.email.received_at,
          }}
        />
      )}
    </div>
  );
}
