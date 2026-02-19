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
    const { email_id, from_name, from_address, subject, snippet } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompt = `You are an email analyst for a healthcare professional. Analyze this email and respond with ONLY valid JSON, no markdown, no code fences.

Email:
From: ${from_name || "Unknown"} <${from_address || "unknown"}>
Subject: ${subject || "(No subject)"}
Body: ${snippet || "(empty)"}

Respond with this exact JSON structure:
{
  "category": one of ["client", "vendor", "billing", "legal", "insurance", "scheduling", "marketing", "personal", "internal", "general"],
  "urgency": number 1-5 (1=low, 5=critical),
  "sentiment": one of ["positive", "negative", "neutral", "urgent"],
  "requires_response": true or false,
  "risk_flags": array of strings like ["payment_overdue", "legal_threat", "deadline_approaching"] or empty array,
  "summary": one sentence summary,
  "suggested_reply": brief suggested reply if requires_response is true otherwise empty string,
  "confidence": number 0.0 to 1.0
}`;

    const payload = JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You are a precise JSON-only email analysis engine. Never output markdown or explanations." },
        { role: "user", content: prompt },
      ],
    });

    let response: Response | null = null;
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: payload,
        });
        break; // success, exit retry loop
      } catch (fetchErr) {
        console.error(`Attempt ${attempt + 1}/${maxRetries} failed:`, fetchErr);
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1))); // backoff 1s, 2s
        } else {
          return new Response(JSON.stringify({ error: "AI gateway unreachable after retries. Please try again." }), {
            status: 503,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted, please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    // Strip potential markdown fences
    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let analysis;
    try {
      analysis = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "Failed to parse analysis", raw: content }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save to AWS if email_id was provided
    if (email_id) {
      try {
        await fetch('https://vr21smw04e.execute-api.us-east-2.amazonaws.com/analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email_id: email_id,
            category: analysis.category,
            urgency: analysis.urgency,
            sentiment: analysis.sentiment,
            requires_response: analysis.requires_response,
            risk_flags: analysis.risk_flags || [],
            summary: analysis.summary,
            suggested_reply: analysis.suggested_reply || '',
            confidence: analysis.confidence || 0.8
          })
        });
        console.log(`Analysis saved to AWS for email_id: ${email_id}`);
      } catch (saveErr) {
        console.error('Failed to save analysis to AWS:', saveErr);
      }
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-email error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
