import { useState, useEffect, useCallback, useRef } from "react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { awsApi } from "@/lib/awsApi";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Send,
  Sparkles,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import RichTextToolbar from "@/components/compose/RichTextToolbar";
import AIDraftPanel from "@/components/compose/AIDraftPanel";
import DraftToneMonitor from "@/components/compose/DraftToneMonitor";
import SignatureManager, { getActiveSignatureHtml } from "@/components/compose/SignatureManager";

export interface ComposeModalProps {
  open: boolean;
  onClose: () => void;
  replyTo?: {
    id: string;
    nylas_id: string;
    from_name: string;
    from_address: string;
    subject: string;
    snippet: string;
    body?: string;
    received_at: string;
  };
  forwardFrom?: {
    from_name: string;
    from_address: string;
    to_addresses: { name?: string; email: string }[];
    subject: string;
    body?: string;
    snippet: string;
    received_at: string;
    has_attachments?: boolean;
  };
  initialCc?: string;
  sentiment?: string;
}

const DRAFT_STORAGE_KEY = "inbox-agent-draft";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function loadDraft(): { to: string; cc: string; bcc: string; subject: string; body: string } | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function ComposeModal({ open, onClose, replyTo, forwardFrom, initialCc, sentiment }: ComposeModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState("");
  const [sending, setSending] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [fromEmail, setFromEmail] = useState("");
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>();

  // ─── Fetch account ───
  useEffect(() => {
    if (!open || !user?.id) return;
    awsApi.getAccounts(user.id).then((data) => {
      const accounts = data?.accounts ?? data;
      if (Array.isArray(accounts) && accounts.length > 0) {
        setAccountId(accounts[0].id ?? accounts[0].account_id);
        setFromEmail(accounts[0].email ?? accounts[0].email_address ?? user.email ?? "");
      }
    }).catch(() => {});
  }, [open, user?.id, user?.email]);

  // ─── Pre-fill for reply / forward / restore draft ───
  useEffect(() => {
    if (!open) return;

    if (replyTo) {
      setTo(replyTo.from_address);
      setSubject(replyTo.subject.startsWith("Re:") ? replyTo.subject : `Re: ${replyTo.subject}`);
      if (bodyRef.current) {
        const sig = getActiveSignatureHtml();
        bodyRef.current.innerHTML = sig;
      }
    } else if (forwardFrom) {
      setTo("");
      const fwdSubject = forwardFrom.subject.startsWith("Fwd:") ? forwardFrom.subject : `Fwd: ${forwardFrom.subject}`;
      setSubject(fwdSubject);
      if (bodyRef.current) {
        const toList = (forwardFrom.to_addresses ?? []).map((r) => r.email).join(", ");
        const dateStr = format(new Date(forwardFrom.received_at), "MMM d, yyyy 'at' h:mm a");
        const sig = getActiveSignatureHtml();
        const attachNote = forwardFrom.has_attachments
          ? `<p style="color:#888;font-style:italic">[Attachments from original email are not included]</p>`
          : "";
        bodyRef.current.innerHTML = `${sig}<br/><br/>---------- Forwarded message ----------<br/>From: ${forwardFrom.from_name || forwardFrom.from_address} &lt;${forwardFrom.from_address}&gt;<br/>Date: ${dateStr}<br/>Subject: ${forwardFrom.subject}<br/>To: ${toList}<br/><br/>${attachNote}${forwardFrom.body || forwardFrom.snippet}`;
      }
    } else {
      // New email — restore draft
      const draft = loadDraft();
      if (draft) {
        setTo(draft.to);
        setSubject(draft.subject);
        setCc(draft.cc);
        setBcc(draft.bcc);
        setShowCcBcc(!!(draft.cc || draft.bcc));
        if (bodyRef.current) bodyRef.current.innerHTML = draft.body;
        setDraftSaved(true);
      } else {
        setTo("");
        setSubject("");
        if (bodyRef.current) {
          const sig = getActiveSignatureHtml();
          bodyRef.current.innerHTML = sig;
        }
      }
    }

    setCc(initialCc ?? "");
    setBcc("");
    setShowCcBcc(!!initialCc);
    setShowAiPanel(false);
    setDraftSaved(false);
  }, [open, replyTo, forwardFrom, initialCc]);

  // ─── Auto-save draft (new emails only) ───
  const saveDraft = useCallback(() => {
    if (replyTo || forwardFrom) return;
    const body = bodyRef.current?.innerHTML ?? "";
    if (!to && !subject && !body) {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      return;
    }
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ to, cc, bcc, subject, body }));
    setDraftSaved(true);
  }, [to, cc, bcc, subject, replyTo, forwardFrom]);

  useEffect(() => {
    if (!open) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(saveDraft, 1500);
    return () => clearTimeout(autoSaveTimer.current);
  }, [to, cc, bcc, subject, open, saveDraft]);

  const handleBodyInput = () => {
    setDraftSaved(false);
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(saveDraft, 1500);
  };

  // ─── Helpers ───
  const parseRecipients = (input: string) =>
    input.split(",").map((s) => s.trim()).filter(Boolean).map((email) => ({ email }));

  const getBody = () => bodyRef.current?.innerHTML ?? "";

  // ─── Send ───
  const handleSend = useCallback(async () => {
    if (!user?.id || !accountId) {
      toast({ title: "No email account connected", variant: "destructive" });
      return;
    }
    const recipients = parseRecipients(to);
    if (recipients.length === 0) {
      toast({ title: "Please add at least one recipient", variant: "destructive" });
      return;
    }
    // Validate emails
    const invalidEmails = recipients.filter((r) => !isValidEmail(r.email));
    if (invalidEmails.length > 0) {
      toast({
        title: "Invalid email address",
        description: `Please fix: ${invalidEmails.map((r) => r.email).join(", ")}`,
        variant: "destructive",
      });
      return;
    }
    if (!subject.trim()) {
      toast({ title: "Please add a subject", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const body = getBody() || "<p></p>";
      await awsApi.sendEmail({
        user_id: user.id,
        account_id: accountId,
        to: recipients,
        cc: cc ? parseRecipients(cc) : undefined,
        bcc: bcc ? parseRecipients(bcc) : undefined,
        subject,
        body,
        reply_to_message_id: replyTo?.nylas_id,
      });
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      toast({ title: "✓ Email sent successfully" });
      onClose();
    } catch {
      toast({ title: "Failed to send email", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }, [user?.id, accountId, to, cc, bcc, subject, replyTo, toast, onClose]);

  // ─── AI draft callbacks ───
  const applyDraft = useCallback((body: string, draftSubject?: string) => {
    if (bodyRef.current) bodyRef.current.innerHTML = body;
    if (!replyTo && draftSubject) setSubject(draftSubject);
  }, [replyTo]);

  const applyDraftAndClose = useCallback((body: string, draftSubject?: string) => {
    applyDraft(body, draftSubject);
    setShowAiPanel(false);
  }, [applyDraft]);

  // ─── Quoted block ───
  const quotedBlock = replyTo
    ? `<div style="margin-top:16px;padding-top:8px;border-top:1px solid #444;color:#888;font-size:12px">On ${format(new Date(replyTo.received_at), "MMM d, yyyy 'at' h:mm a")}, ${replyTo.from_name || replyTo.from_address} wrote:<br/><blockquote style="margin:8px 0 0 8px;padding-left:8px;border-left:2px solid #555">${replyTo.snippet}</blockquote></div>`
    : "";

  const isNewEmail = !replyTo && !forwardFrom;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <DialogTitle className="text-base font-semibold">
              {replyTo
                ? `Reply to: ${replyTo.subject}`
                : forwardFrom
                ? `Forward: ${forwardFrom.subject}`
                : "New Email"}
            </DialogTitle>
            {(draftSaved || isNewEmail) && (
              <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground border-muted-foreground/30">
                Draft
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-1 flex-col overflow-y-auto">
          {/* From */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-2">
            <span className="w-12 text-xs text-muted-foreground">From</span>
            <span className="text-sm text-foreground/80">{fromEmail || "Loading..."}</span>
          </div>

          {/* To */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-2">
            <span className="w-12 text-xs text-muted-foreground">To</span>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="h-8 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground"
              onClick={() => setShowCcBcc(!showCcBcc)}
            >
              CC/BCC
              {showCcBcc ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />}
            </Button>
          </div>

          {/* CC / BCC */}
          {showCcBcc && (
            <>
              <div className="flex items-center gap-2 border-b border-border px-4 py-2">
                <span className="w-12 text-xs text-muted-foreground">CC</span>
                <Input
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="cc@example.com"
                  className="h-8 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                />
              </div>
              <div className="flex items-center gap-2 border-b border-border px-4 py-2">
                <span className="w-12 text-xs text-muted-foreground">BCC</span>
                <Input
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="bcc@example.com"
                  className="h-8 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                />
              </div>
            </>
          )}

          {/* Subject */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-2">
            <span className="w-12 text-xs text-muted-foreground">Subject</span>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className="h-8 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
            />
          </div>

          {/* Rich text toolbar */}
          <RichTextToolbar />

          {/* Body (contentEditable) */}
          <div className="flex-1 px-4 py-3">
            <div
              ref={bodyRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleBodyInput}
              className="min-h-[180px] text-sm text-foreground outline-none [&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
              data-placeholder="Write your email..."
              style={{ minHeight: 180 }}
            />
            {replyTo && (
              <div className="mt-4" dangerouslySetInnerHTML={{ __html: quotedBlock }} />
            )}
          </div>

          {/* Real-time tone monitor */}
          <DraftToneMonitor bodyRef={bodyRef as React.RefObject<HTMLDivElement>} />

          {/* AI Draft Panel */}
          {showAiPanel && (
            <AIDraftPanel
              replyTo={replyTo}
              onApplyDraft={applyDraft}
              onApplyAndClose={applyDraftAndClose}
              sentiment={sentiment}
            />
          )}
        </div>

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Button onClick={handleSend} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </Button>
            <Button
              variant={showAiPanel ? "secondary" : "outline"}
              onClick={() => setShowAiPanel(!showAiPanel)}
            >
              <Sparkles className="h-4 w-4" />
              AI Draft
            </Button>
            <SignatureManager />
          </div>
          <Button variant="ghost" size="icon" onClick={() => {
            localStorage.removeItem(DRAFT_STORAGE_KEY);
            onClose();
          }}>
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
