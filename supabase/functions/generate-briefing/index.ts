import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emails } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build email lookup map for enriching Gemini output with email_ids
    const emailLookup: Record<string, string> = {};
    (emails || []).forEach((email: any) => {
      if (email.subject && email.id) {
        const key = email.subject.trim().toLowerCase();
        emailLookup[key] = email.id;
      }
      if (email.from_address && email.subject && email.id) {
        const key2 = `${email.from_address}::${email.subject.trim().toLowerCase()}`;
        emailLookup[key2] = email.id;
      }
    });

    const emailList = (emails || [])
      .map(
        (e: any, i: number) =>
          `${i + 1}. From: ${e.from_name || "Unknown"} <${e.from_address || ""}>
   Subject: ${e.subject || "(No subject)"}
   Category: ${e.category || "unknown"}
   Urgency: ${e.urgency ?? "N/A"}/5
   Sentiment: ${e.sentiment || "unknown"}
   Risk Flags: ${e.risk_flags?.length ? e.risk_flags.join(", ") : "none"}
   Requires Response: ${e.requires_response ? "yes" : "no"}`
      )
      .join("\n\n");

    const prompt = `You are an executive assistant for a healthcare professional. Generate a daily morning briefing summarizing their inbox. Here are the emails from the last 24 hours:

${emailList || "No emails received in the last 24 hours."}

Respond with ONLY valid JSON, no markdown, no code fences. Use this exact structure:
{
  "summary": "2-3 sentence overview of the inbox state",
  "highlights": ["array of key items needing attention"],
  "urgent_items": [{"subject": "...", "from": "...", "reason": "..."}],
  "action_items": ["array of things to follow up on"],
  "stats": {
    "total_new": number,
    "urgent_count": number,
    "requires_response_count": number,
    "categories": {"category_name": count}
  }
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You are a precise JSON-only briefing generator. Never output markdown or explanations.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted, please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ error: "AI briefing generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let briefing;
    try {
      briefing = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ error: "Failed to parse briefing", raw: content }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enrich urgent_items with email_ids
    if (briefing.urgent_items && Array.isArray(briefing.urgent_items)) {
      briefing.urgent_items = briefing.urgent_items.map((item: any) => {
        const subjectKey = (item.subject || "").trim().toLowerCase();
        let emailId = emailLookup[subjectKey];

        if (!emailId && item.from && item.subject) {
          // Try from+subject combo
          const fromAddr = item.from.replace(/.*<([^>]+)>.*/, "$1").trim();
          const comboKey = `${fromAddr}::${subjectKey}`;
          emailId = emailLookup[comboKey];
        }

        return { ...item, email_id: emailId || null };
      });
    }

    return new Response(JSON.stringify(briefing), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-briefing error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
