import { supabase } from "@/integrations/supabase/client";
import { awsApi } from "@/lib/awsApi";

export interface BriefingContent {
  summary: string;
  highlights: string[];
  urgent_items: { subject: string; from: string; reason: string }[];
  action_items: string[];
  stats: {
    total_new: number;
    urgent_count: number;
    requires_response_count: number;
    categories: Record<string, number>;
  };
}

export interface Briefing {
  id: string;
  date: string;
  type: string;
  content: BriefingContent;
  urgent_count: number;
  pending_count: number;
  generated_at: string;
}

export async function generateBriefing(userId: string): Promise<Briefing> {
  // 1. Fetch recent emails — inbox-get-emails already returns category/urgency/sentiment
  //    from the ai_analysis join (fixed in last session). No need for getAllAnalyses.
  const emailsRes = await awsApi.getEmails(userId, 1, 100, "inbox");
  const emails = emailsRes?.emails ?? [];

  // 2. Build enriched list directly from the email objects (which already have analysis fields)
  //    Fallback: if emails don't have category yet, try fetching analyses separately
  const hasAnalysis = emails.some((e: any) => e.category || e.urgency);

  let enrichedEmails: any[];

  if (hasAnalysis) {
    // Emails already have analysis fields — use them directly
    enrichedEmails = emails.map((e: any) => ({
      id: e.id,
      from_name: e.from_name,
      from_address: e.from_address,
      subject: e.subject,
      category: e.category || null,
      urgency: e.urgency ?? null,
      sentiment: e.sentiment || null,
      risk_flags: e.risk_flags || [],
      requires_response: e.requires_response ?? false,
    }));
  } else {
    // Fallback: fetch analyses separately and merge
    console.warn("[briefingService] Emails missing analysis fields, fetching analyses separately");
    const analysesRaw = await awsApi.getAllAnalyses(userId);
    const analysesList = Array.isArray(analysesRaw)
      ? analysesRaw
      : Array.isArray(analysesRaw?.analyses)
        ? analysesRaw.analyses
        : [];
    const analysesMap: Record<string, any> = {};
    for (const a of analysesList) {
      if (a.email_id) analysesMap[a.email_id] = a;
    }

    enrichedEmails = emails.map((e: any) => {
      const a = analysesMap[e.id] || {};
      return {
        id: e.id,
        from_name: e.from_name,
        from_address: e.from_address,
        subject: e.subject,
        category: a.category ?? e.category ?? null,
        urgency: a.urgency ?? e.urgency ?? null,
        sentiment: a.sentiment ?? e.sentiment ?? null,
        risk_flags: a.risk_flags ?? e.risk_flags ?? [],
        requires_response: a.requires_response ?? e.requires_response ?? false,
      };
    });
  }

  // 3. Log what we're sending to the edge function (for debugging)
  const withAnalysis = enrichedEmails.filter((e) => e.category || e.urgency).length;
  console.log(
    `[briefingService] Sending ${enrichedEmails.length} emails to generate-briefing, ${withAnalysis} have analysis`,
  );

  // 4. Call the edge function with fully enriched emails
  const { data, error } = await supabase.functions.invoke("generate-briefing", {
    body: { emails: enrichedEmails },
  });

  if (error) throw new Error(error.message ?? "Briefing generation failed");
  if (data?.error) throw new Error(data.error);

  const content = data as BriefingContent;
  const today = new Date().toISOString().split("T")[0];

  // 5. Store via AWS API
  const urgentCount = content.stats?.urgent_count ?? 0;
  const pendingCount = content.stats?.requires_response_count ?? 0;

  const storeResult = await awsApi.storeBriefing({
    user_id: userId,
    date: today,
    type: "morning",
    content,
    urgent_count: urgentCount,
    pending_count: pendingCount,
  });

  // Fire-and-forget: notify orchestrator to create tasks from briefing
  const briefingId = storeResult?.id ?? `${today}-morning`;
  fetch("https://vr21smw04e.execute-api.us-east-2.amazonaws.com/briefing-orchestrator", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "create_tasks_from_briefing",
      user_id: userId,
      briefing_id: briefingId,
      content,
    }),
  }).catch((e) => console.log("Orchestrator call failed silently:", e));

  return {
    id: briefingId,
    date: today,
    type: "morning",
    content,
    urgent_count: urgentCount,
    pending_count: pendingCount,
    generated_at: new Date().toISOString(),
  };
}
