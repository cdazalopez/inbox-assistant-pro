import { useEffect, useState, useCallback } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { awsApi } from "@/lib/awsApi";
import { EmailAnalysis } from "@/components/inbox/types";
import AlertBell from "@/components/alerts/AlertBell";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [urgentEmails, setUrgentEmails] = useState<
    { id: string; subject: string; received_at: string; analysis: EmailAnalysis }[]
  >([]);

  const fetchUrgent = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [analysesRes, emailsRes] = await Promise.all([
        awsApi.getAllAnalyses(user.id),
        awsApi.getEmails(user.id, 1, 200, "inbox"),
      ]);

      const analyses: Record<string, EmailAnalysis> =
        Array.isArray(analysesRes)
          ? Object.fromEntries(analysesRes.filter((a: any) => a.email_id).map((a: any) => [a.email_id, a]))
          : analysesRes ?? {};

      const emails = emailsRes?.emails ?? [];
      const urgent = emails
        .filter((e: any) => {
          const a = analyses[e.id];
          if (!a) return false;
          return a.urgency >= 4 || (a.risk_flags?.length > 0);
        })
        .map((e: any) => ({
          id: e.id,
          subject: e.subject,
          received_at: e.received_at,
          analysis: analyses[e.id],
        }));
      setUrgentEmails(urgent);
    } catch {
      // silently fail
    }
  }, [user?.id]);

  useEffect(() => {
    fetchUrgent();
  }, [fetchUrgent]);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1">
          <header className="flex h-14 items-center border-b border-border px-4">
            <SidebarTrigger />
            <div className="ml-auto flex items-center gap-2">
              <AlertBell urgentEmails={urgentEmails} />
            </div>
          </header>
          <div className="p-6">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
