import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildFallbackBriefing(emails: any[]) {
  const urgentEmails = emails.filter((e: any) => (e.urgency ?? 0) >= 4);
  const needsResponse = emails.filter((e: any) => e.requires_response);
  const categories: Record<string, number> = {};
  for (const e of emails) {
    const cat = e.category || "general";
    categories[cat] = (categories[cat] || 0) + 1;
  }

  return {
    summary: `You have ${emails.length} emails. ${urgentEmails.length} are urgent and ${needsResponse.length} need a response.`,
    highlights: urgentEmails.slice(0, 3).map((e: any) => `${e.from_name || "Unknown"}: ${e.subject || "(No subject)"}`),
    urgent_items: urgentEmails.map((e: any) => ({
      subject: e.subject || "(No subject)",
      from: e.from_name || e.from_address || "Unknown",
      reason: `Urgency ${e.urgency}/5${e.risk_flags?.length ? " — " + e.risk_flags.join(", ") : ""}`,
      email_id: e.id || null,
    })),
    action_items: needsResponse.slice(0, 5).map((e: any) => `Reply to ${e.from_name || "Unknown"} re: ${e.subject || "(No subject)"}`),
    stats: {
      total_new: emails.length,
      urgent_count: urgentEmails.length,
      requires_response_count: needsResponse.length,
      categories,
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emails } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build email lookup map for enriching output with email_ids
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

CRITICAL RULES:
- Return ONLY valid JSON, no markdown, no code fences, no explanation
- urgent_items MUST list each urgent email individually where urgency >= 4 OR requires_response = true
- Each urgent_item needs: subject (exact email subject), from (sender name), reason (why it needs attention)
- action_items must be specific actionable tasks, minimum 3 items
- categories must use actual category names from the emails: marketing, personal, billing, legal, internal, vendor, general
- Never group everything under "general" — break down by real categories
- If no urgent emails exist return empty array for urgent_items

Use this exact JSON structure:

{
  "summary": "2-3 sentence overview mentioning specific senders and topics",
  "highlights": ["specific item 1", "specific item 2", "specific item 3"],
  "urgent_items": [
    {
      "subject": "exact subject line",
      "from": "sender name",
      "reason": "specific reason this needs attention"
    }
  ],
  "action_items": [
    "specific action with context"
  ],
  "stats": {
    "total_new": number,
    "urgent_count": number,
    "requires_response_count": number,
    "categories": {
      "marketing": number,
      "personal": number,
      "billing": number
    }
  }
}`;

    // Retry up to 3 times with backoff
    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.0-flash-001",
            messages: [
              { role: "system", content: "You are a precise JSON-only briefing generator. Never output markdown or explanations." },
              { role: "user", content: prompt },
            ],
          }),
        });
        if (response.ok) break;
        console.error(`Attempt ${attempt + 1} failed: ${response.status}`);
      } catch (fetchErr) {
        console.error(`Attempt ${attempt + 1} fetch error:`, fetchErr);
      }
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }

    // If AI gateway is down, return a fallback briefing built from raw data
    if (!response || !response.ok) {
      const errorStatus = response?.status;
      console.error("AI gateway unavailable after retries, using fallback. Last status:", errorStatus);

      if (errorStatus === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (errorStatus === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted, please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Return fallback briefing instead of error
      const fallback = buildFallbackBriefing(emails || []);
      return new Response(JSON.stringify(fallback), {
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
      // Fall back instead of erroring
      const fallback = buildFallbackBriefing(emails || []);
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enrich urgent_items with email_ids
    if (briefing.urgent_items && Array.isArray(briefing.urgent_items)) {
      briefing.urgent_items = briefing.urgent_items.map((item: any) => {
        const subjectKey = (item.subject || "").trim().toLowerCase();
        let emailId = emailLookup[subjectKey];

        if (!emailId && item.from && item.subject) {
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
