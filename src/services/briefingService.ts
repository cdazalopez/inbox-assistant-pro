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
  // 1. Fetch recent emails (last 24h worth — grab 100 most recent)
  const emailsRes = await awsApi.getEmails(userId, 1, 100, "inbox");
  const emails = emailsRes?.emails ?? [];

  // 2. Fetch all analyses — API may return { analyses: [...] } or raw array
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

  // 3. Merge email data with analysis for the prompt
  const enrichedEmails = emails.map((e: any) => {
    const a = analysesMap[e.id] || {};
    return {
      id: e.id,
      from_name: e.from_name,
      from_address: e.from_address,
      subject: e.subject,
      category: a.category,
      urgency: a.urgency,
      sentiment: a.sentiment,
      risk_flags: a.risk_flags,
      requires_response: a.requires_response,
    };
  });

  // 4. Call the edge function
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
  fetch('https://vr21smw04e.execute-api.us-east-2.amazonaws.com/briefing-orchestrator', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create_tasks_from_briefing',
      user_id: userId,
      briefing_id: briefingId,
      content,
    }),
  }).catch((e) => console.log('Orchestrator call failed silently:', e));

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
