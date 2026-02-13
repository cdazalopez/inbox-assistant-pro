import { supabase } from "@/integrations/supabase/client";

export type DraftTone = "professional" | "friendly" | "firm" | "empathetic" | "concise";

interface GenerateDraftParams {
  originalEmail?: {
    from: string;
    subject: string;
    body: string;
    date: string;
  };
  tone: DraftTone;
  context?: string;
  isReply: boolean;
}

export interface DraftResult {
  subject: string;
  body: string;
}

export async function generateDraft(params: GenerateDraftParams): Promise<DraftResult> {
  const { data, error } = await supabase.functions.invoke("generate-draft", {
    body: {
      originalEmail: params.originalEmail,
      tone: params.tone,
      context: params.context,
      isReply: params.isReply,
    },
  });

  if (error) throw new Error(error.message ?? "Draft generation failed");
  if (data?.error) throw new Error(data.error);
  return data as DraftResult;
}
