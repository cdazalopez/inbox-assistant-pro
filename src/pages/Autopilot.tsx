import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { awsApi } from "@/lib/awsApi";
import { useToast } from "@/hooks/use-toast";
import { useAutopilot, isAutoDraftable, AutopilotDraft } from "@/hooks/useAutopilot";
import { generateDraft } from "@/services/aiDraftService";
import { getOrAnalyze } from "@/services/aiAnalysis";
import { Email, EmailAnalysis } from "@/components/inbox/types";
import AutopilotToggle from "@/components/autopilot/AutopilotToggle";
import AutopilotQueue from "@/components/autopilot/AutopilotQueue";
import AutopilotSettingsCard from "@/components/autopilot/AutopilotSettingsCard";
import { Bot, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AutopilotPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const autopilot = useAutopilot();

  const [accountId, setAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    awsApi.getAccounts(user.id).then((data) => {
      const accounts = data?.accounts ?? data;
      if (Array.isArray(accounts) && accounts.length > 0) {
        setAccountId(accounts[0].id ?? accounts[0].account_id);
      }
    }).catch(() => {});
  }, [user?.id]);

  // Auto-draft when autopilot is active
  useEffect(() => {
    if (!autopilot.isActive || !user?.id || autopilot.processingRef.current) return;

    const run = async () => {
      autopilot.processingRef.current = true;
      autopilot.setProcessing(true);
      setLoading(true);
      try {
        const [emailsRes, analysesRes] = await Promise.all([
          awsApi.getEmails(user.id, 1, 100, "inbox"),
          awsApi.getAllAnalyses(user.id),
        ]);
        const emails: Email[] = emailsRes.emails ?? [];
        const analysesMap: Record<string, EmailAnalysis> = {};
        const raw = analysesRes;
        if (Array.isArray(raw)) {
          for (const a of raw) { if (a.email_id) analysesMap[a.email_id] = a; }
        } else if (raw && typeof raw === "object") {
          Object.assign(analysesMap, raw);
        }

        const qualifying = emails.filter((e) => {
          const analysis = analysesMap[e.id];
          if (!analysis) return false;
          if (autopilot.drafts.has(e.id)) return false;
          return isAutoDraftable(e, analysis, autopilot.prefs);
        });

        const batch = qualifying.slice(0, 5);
        for (const email of batch) {
          try {
            const analysis = analysesMap[email.id];
            const draft = await generateDraft({
              originalEmail: {
                from: `${email.from_name} <${email.from_address}>`,
                subject: email.subject,
                body: email.snippet,
                date: email.received_at,
              },
              tone: autopilot.prefs.defaultTone,
              isReply: true,
            });
            autopilot.addDraft({
              emailId: email.id,
              email,
              analysis,
              draftSubject: draft.subject,
              draftBody: draft.body,
              tone: autopilot.prefs.defaultTone,
              status: "pending",
              createdAt: new Date().toISOString(),
            });
          } catch (err) {
            console.error("Autopilot draft failed for", email.id, err);
          }
        }
        if (batch.length > 0) {
          toast({ title: `🤖 Autopilot drafted ${batch.length} replies for review` });
        }
      } catch {
        toast({ title: "Failed to load emails", variant: "destructive" });
      } finally {
        autopilot.setProcessing(false);
        autopilot.processingRef.current = false;
        setLoading(false);
      }
    };

    run();
  }, [autopilot.isActive, user?.id]);

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Autopilot</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              AI-drafted replies queued for your approval
            </p>
          </div>
        </div>
        <AutopilotToggle
          prefs={autopilot.prefs}
          updatePrefs={autopilot.updatePrefs}
          pendingCount={autopilot.pendingCount}
          onOpenQueue={() => {}}
        />
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating drafts for qualifying emails…
        </div>
      )}

      <AutopilotQueue
        pendingDrafts={autopilot.pendingDrafts}
        stats={autopilot.stats}
        onApprove={(id) => autopilot.updateDraftStatus(id, "sent")}
        onReject={(id, reason) => autopilot.updateDraftStatus(id, "rejected", reason)}
        onUpdateBody={autopilot.updateDraftBody}
        accountId={accountId}
      />

      <AutopilotSettingsCard prefs={autopilot.prefs} updatePrefs={autopilot.updatePrefs} />
    </div>
  );
}
