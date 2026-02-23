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
    const { user_input, events, account_email, today } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const eventList = (events || [])
      .map((e: any) => `id:${e.id} | title:${e.title} | start:${e.start}`)
      .join("\n");

    const systemPrompt = `You are a calendar assistant. Parse the user's natural language command into a structured action. Today is ${today}. User's calendar email: ${account_email || "unknown"}.

Current calendar events:
${eventList || "none"}

Respond using the provided tool.

Rules:
- Times must be ISO 8601 with timezone offset (use the offset implied by the user or default to -06:00 for US Central)
- Parse day/time carefully: "tomorrow at 2pm" = next day at 14:00
- Default event duration is 1 hour if not specified
- For delete: find the best matching event_id from the event list above
- If unclear or you can't determine what to do, use action "unknown" with a helpful message`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: user_input },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "calendar_action",
                description:
                  "Return a structured calendar action: create, delete, or unknown.",
                parameters: {
                  type: "object",
                  properties: {
                    action: {
                      type: "string",
                      enum: ["create", "delete", "unknown"],
                    },
                    title: { type: "string", description: "Event title" },
                    start_time: {
                      type: "string",
                      description: "ISO 8601 start time (for create)",
                    },
                    end_time: {
                      type: "string",
                      description: "ISO 8601 end time (for create)",
                    },
                    event_id: {
                      type: "string",
                      description: "ID of event to delete (for delete)",
                    },
                    message: {
                      type: "string",
                      description: "Explanation message (for unknown)",
                    },
                  },
                  required: ["action"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "calendar_action" },
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();

    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call returned from AI");
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-calendar-command error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
