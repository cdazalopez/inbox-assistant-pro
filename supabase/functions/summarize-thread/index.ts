import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { emails } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return new Response(JSON.stringify({ error: "No emails provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailList = emails
      .map(
        (e: any, i: number) =>
          `Email ${i + 1}:\n  From: ${e.from_name || e.from_address}\n  Date: ${e.received_at}\n  Subject: ${e.subject}\n  Body: ${e.snippet || e.body || "(no content)"}`
      )
      .join("\n\n");

    const prompt = `You are an executive assistant summarizing an email thread for a healthcare professional. Here is the email thread in chronological order:

${emailList}

Generate a concise thread summary as JSON with these fields:
- timeline: array of {date, from, action} where action is a 1-sentence summary of what that person said/did
- decisions: array of strings - any decisions that were made
- pending: array of strings - anything still unresolved or waiting for response
- key_points: array of strings - the 3-5 most important takeaways
- participants: array of {name, email, message_count} - who was involved and how active`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a helpful assistant. Return only valid JSON, no markdown fences." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "thread_summary",
              description: "Return a structured thread summary",
              parameters: {
                type: "object",
                properties: {
                  timeline: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        date: { type: "string" },
                        from: { type: "string" },
                        action: { type: "string" },
                      },
                      required: ["date", "from", "action"],
                    },
                  },
                  decisions: { type: "array", items: { type: "string" } },
                  pending: { type: "array", items: { type: "string" } },
                  key_points: { type: "array", items: { type: "string" } },
                  participants: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        email: { type: "string" },
                        message_count: { type: "number" },
                      },
                      required: ["name", "email", "message_count"],
                    },
                  },
                },
                required: ["timeline", "decisions", "pending", "key_points", "participants"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "thread_summary" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const summary = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
      return new Response(JSON.stringify(summary), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: try parsing content directly
    const content = result.choices?.[0]?.message?.content ?? "";
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("summarize-thread error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
