import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { awsApi } from "@/lib/awsApi";
import { generateDraft, type DraftTone } from "@/services/aiDraftService";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  X,
  Send,
  Sparkles,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
} from "lucide-react";

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
  initialCc?: string;
}

const TONES: { value: DraftTone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "firm", label: "Firm" },
  { value: "empathetic", label: "Empathetic" },
  { value: "concise", label: "Concise" },
];

export default function ComposeModal({ open, onClose, replyTo, initialCc }: ComposeModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [fromEmail, setFromEmail] = useState("");

  // AI draft state
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [tone, setTone] = useState<DraftTone>("professional");
  const [aiContext, setAiContext] = useState("");
  const [generating, setGenerating] = useState(false);

  // Fetch account on open
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

  // Pre-fill for replies
  useEffect(() => {
    if (!open) return;
    if (replyTo) {
      setTo(replyTo.from_address);
      setSubject(replyTo.subject.startsWith("Re:") ? replyTo.subject : `Re: ${replyTo.subject}`);
      setBody("");
    } else {
      setTo("");
      setSubject("");
      setBody("");
    }
    setCc(initialCc ?? "");
    setBcc("");
    setShowCcBcc(!!initialCc);
    setShowAiPanel(false);
    setAiContext("");
  }, [open, replyTo, initialCc]);

  const parseRecipients = (input: string) =>
    input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((email) => ({ email }));

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
    if (!subject.trim()) {
      toast({ title: "Please add a subject", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      await awsApi.sendEmail({
        user_id: user.id,
        account_id: accountId,
        to: recipients,
        cc: cc ? parseRecipients(cc) : undefined,
        bcc: bcc ? parseRecipients(bcc) : undefined,
        subject,
        body: body || "<p></p>",
        reply_to_message_id: replyTo?.nylas_id,
      });
      toast({ title: "Email sent successfully" });
      onClose();
    } catch {
      toast({ title: "Failed to send email", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }, [user?.id, accountId, to, cc, bcc, subject, body, replyTo, toast, onClose]);

  const handleGenerateDraft = useCallback(async () => {
    setGenerating(true);
    try {
      const draft = await generateDraft({
        originalEmail: replyTo
          ? {
              from: `${replyTo.from_name} <${replyTo.from_address}>`,
              subject: replyTo.subject,
              body: replyTo.body ?? replyTo.snippet,
              date: replyTo.received_at,
            }
          : undefined,
        tone,
        context: aiContext || undefined,
        isReply: !!replyTo,
      });
      setBody(draft.body);
      if (!replyTo && draft.subject) setSubject(draft.subject);
      toast({ title: "AI draft generated" });
    } catch (err: any) {
      toast({ title: err?.message || "Failed to generate draft", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }, [replyTo, tone, aiContext, toast]);

  const quotedBlock = replyTo
    ? `\n\n---\nOn ${format(new Date(replyTo.received_at), "MMM d, yyyy 'at' h:mm a")}, ${replyTo.from_name || replyTo.from_address} wrote:\n> ${(replyTo.snippet || "").replace(/\n/g, "\n> ")}`
    : "";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <DialogTitle className="text-base font-semibold">
            {replyTo ? `Reply to: ${replyTo.subject}` : "New Email"}
          </DialogTitle>
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

          {/* Body */}
          <div className="flex-1 px-4 py-3">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email..."
              className="min-h-[200px] resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
            />
            {replyTo && (
              <pre className="mt-4 whitespace-pre-wrap text-xs text-muted-foreground">{quotedBlock}</pre>
            )}
          </div>

          {/* AI Draft Panel */}
          {showAiPanel && (
            <div className="border-t border-border bg-muted/30 px-4 py-3 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">AI Draft Assistant</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TONES.map((t) => (
                  <Button
                    key={t.value}
                    variant={tone === t.value ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setTone(t.value)}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
              <Input
                value={aiContext}
                onChange={(e) => setAiContext(e.target.value)}
                placeholder="Instructions: e.g. 'decline politely' or 'ask for invoice details'"
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleGenerateDraft} disabled={generating}>
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate Draft
                    </>
                  )}
                </Button>
                {body && (
                  <Button variant="outline" size="sm" onClick={handleGenerateDraft} disabled={generating}>
                    <RefreshCw className="h-4 w-4" />
                    Regenerate
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <div className="flex gap-2">
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
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
