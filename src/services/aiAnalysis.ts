import { supabase } from "@/integrations/supabase/client";
import { awsApi } from "@/lib/awsApi";

export interface EmailAnalysis {
  category: string;
  urgency: number;
  sentiment: string;
  requires_response: boolean;
  risk_flags: string[];
  summary: string;
  suggested_reply: string;
  confidence: number;
}

interface EmailInput {
  id: string;
  from_name: string;
  from_address: string;
  subject: string;
  snippet: string;
  user_id: string;
}

export async function analyzeEmail(email: EmailInput): Promise<EmailAnalysis> {
  const { data, error } = await supabase.functions.invoke("analyze-email", {
    body: {
      email_id: email.id,
      from_name: email.from_name,
      from_address: email.from_address,
      subject: email.subject,
      snippet: email.snippet,
    },
  });

  if (error) throw new Error(error.message ?? "Analysis failed");
  if (data?.error) throw new Error(data.error);
  return data as EmailAnalysis;
}

export async function getOrAnalyze(emailId: string, email: EmailInput, forceRefresh = false): Promise<EmailAnalysis> {
  // Check for existing analysis (unless force refresh)
  if (!forceRefresh) {
    const existing = await awsApi.getAnalysis(emailId);
    if (existing && !existing.error && existing.category) {
      return existing as EmailAnalysis;
    }
  }

  // Run AI analysis
  const analysis = await analyzeEmail(email);

  // Store for future use (fire-and-forget)
  awsApi.storeAnalysis({
    email_id: emailId,
    user_id: email.user_id,
    ...analysis,
  }).catch(console.error);

  return analysis;
}
