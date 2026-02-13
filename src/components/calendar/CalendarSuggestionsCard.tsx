import { useState, useMemo } from "react";
import { awsApi } from "@/lib/awsApi";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { CalendarPlus, Check, X, Loader2 } from "lucide-react";
import { EmailAnalysis } from "@/components/inbox/types";
import { format, addDays, parse } from "date-fns";

export interface CalendarSuggestion {
  id: string;
  emailId: string;
  emailSubject: string;
  title: string;
  description: string;
  suggestedDate: string; // ISO
  allDay: boolean;
  type: "deadline" | "meeting" | "payment" | "event";
}

function extractSuggestions(
  analysesMap: Record<string, EmailAnalysis>,
  emailsMap: Record<string, { subject: string; snippet: string }>
): CalendarSuggestion[] {
  const suggestions: CalendarSuggestion[] = [];

  for (const [emailId, analysis] of Object.entries(analysesMap)) {
    const email = emailsMap[emailId];
    if (!email) continue;

    const hasDeadlineFlag = analysis.risk_flags?.some(
      (f) => f.includes("deadline") || f.includes("deadline_approaching")
    );
    const isScheduling = analysis.category === "meeting" || analysis.category === "scheduling";
    const isBilling = analysis.category === "billing";

    // Extract dates from summary/snippet using common patterns
    const datePatterns = [
      /(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,?\s+\d{4})?)/gi,
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/g,
    ];

    let detectedDate: Date | null = null;
    const textToSearch = `${analysis.summary} ${email.snippet}`;
    for (const pattern of datePatterns) {
      const match = textToSearch.match(pattern);
      if (match) {
        const parsed = new Date(match[0]);
        if (!isNaN(parsed.getTime()) && parsed > new Date()) {
          detectedDate = parsed;
          break;
        }
      }
    }

    // Fallback: use tomorrow if no date detected
    const fallbackDate = addDays(new Date(), 1);
    const targetDate = detectedDate || fallbackDate;

    if (hasDeadlineFlag) {
      suggestions.push({
        id: `deadline-${emailId}`,
        emailId,
        emailSubject: email.subject,
        title: `Deadline: ${email.subject}`,
        description: `Deadline mentioned in email from ${email.subject}`,
        suggestedDate: targetDate.toISOString(),
        allDay: true,
        type: "deadline",
      });
    } else if (isScheduling) {
      suggestions.push({
        id: `meeting-${emailId}`,
        emailId,
        emailSubject: email.subject,
        title: email.subject,
        description: analysis.summary || "Meeting request",
        suggestedDate: targetDate.toISOString(),
        allDay: false,
        type: "meeting",
      });
    } else if (isBilling) {
      const reminderDate = addDays(targetDate, -1);
      suggestions.push({
        id: `payment-${emailId}`,
        emailId,
        emailSubject: email.subject,
        title: `Payment reminder: ${email.subject}`,
        description: `Payment due – reminder set day before`,
        suggestedDate: reminderDate.toISOString(),
        allDay: true,
        type: "payment",
      });
    }
  }

  return suggestions.slice(0, 5);
}

interface CalendarSuggestionsCardProps {
  analysesMap: Record<string, EmailAnalysis>;
  emailsMap: Record<string, { subject: string; snippet: string }>;
  maxItems?: number;
}

export default function CalendarSuggestionsCard({
  analysesMap,
  emailsMap,
  maxItems = 3,
}: CalendarSuggestionsCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<string | null>(null);

  const suggestions = useMemo(
    () => extractSuggestions(analysesMap, emailsMap),
    [analysesMap, emailsMap]
  );

  const visible = suggestions
    .filter((s) => !dismissed.has(s.id))
    .slice(0, maxItems);

  if (visible.length === 0) return null;

  const handleAdd = async (suggestion: CalendarSuggestion) => {
    if (!user?.id) return;
    setLoading(suggestion.id);
    try {
      const startTime = suggestion.suggestedDate;
      const endTime = suggestion.allDay
        ? startTime
        : new Date(new Date(startTime).getTime() + 60 * 60000).toISOString();

      await awsApi.createCalendarEvent({
        user_id: user.id,
        title: suggestion.title,
        description: suggestion.description,
        start_time: startTime,
        end_time: endTime,
        all_day: suggestion.allDay,
      });

      setAdded((prev) => new Set(prev).add(suggestion.id));
      toast({ title: "Event added to calendar ✅" });
    } catch {
      toast({ title: "Failed to create event", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const typeIcons: Record<string, string> = {
    deadline: "🗓️",
    meeting: "🤝",
    payment: "💰",
    event: "📅",
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <CalendarPlus className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">AI Calendar Suggestions</h2>
      </div>
      <div className="divide-y divide-border">
        {visible.map((s) => {
          const isAdded = added.has(s.id);
          const isLoading = loading === s.id;
          return (
            <div key={s.id} className="flex items-start gap-3 px-5 py-3">
              <span className="text-lg mt-0.5">{typeIcons[s.type] || "📅"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                <p className="text-xs text-muted-foreground truncate">{s.description}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {format(new Date(s.suggestedDate), "MMM d, yyyy")}
                  {s.allDay ? " · All Day" : ` · ${format(new Date(s.suggestedDate), "h:mm a")}`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isAdded ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                    <Check className="h-3.5 w-3.5" />
                    Added
                  </span>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      disabled={isLoading}
                      onClick={() => handleAdd(s)}
                    >
                      {isLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CalendarPlus className="h-3 w-3" />
                      )}
                      Add
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setDismissed((prev) => new Set(prev).add(s.id))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { extractSuggestions };
