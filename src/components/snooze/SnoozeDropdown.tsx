import { useState } from "react";
import { addHours, setHours, setMinutes, addDays, nextMonday } from "date-fns";
import { Clock, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import SnoozeCustomModal from "./SnoozeCustomModal";

interface SnoozeDropdownProps {
  onSnooze: (wakeAt: string, reason: string, contextNote?: string) => Promise<void>;
  emailSubject?: string;
  emailFrom?: string;
  emailSnippet?: string;
  aiContextSuggestion?: string | null;
  loadingAiSuggestion?: boolean;
  compact?: boolean;
}

function getQuickOptions() {
  const now = new Date();

  const laterToday = addHours(now, 4);

  const tomorrowMorning = setMinutes(setHours(addDays(now, 1), 9), 0);
  const tomorrowAfternoon = setMinutes(setHours(addDays(now, 1), 14), 0);

  const nextMon = setMinutes(setHours(nextMonday(now), 9), 0);

  return [
    { label: "Later Today", sublabel: "4 hours", wakeAt: laterToday.toISOString(), reason: "later_today" },
    { label: "Tomorrow Morning", sublabel: "9:00 AM", wakeAt: tomorrowMorning.toISOString(), reason: "tomorrow_morning" },
    { label: "Tomorrow Afternoon", sublabel: "2:00 PM", wakeAt: tomorrowAfternoon.toISOString(), reason: "tomorrow_afternoon" },
    { label: "Next Week", sublabel: "Monday 9 AM", wakeAt: nextMon.toISOString(), reason: "next_week" },
  ];
}

export default function SnoozeDropdown({
  onSnooze,
  emailSubject,
  emailFrom,
  emailSnippet,
  aiContextSuggestion,
  loadingAiSuggestion,
  compact,
}: SnoozeDropdownProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const [snoozing, setSnoozing] = useState(false);
  const options = getQuickOptions();

  const handleQuick = async (opt: (typeof options)[0]) => {
    setSnoozing(true);
    try {
      await onSnooze(opt.wakeAt, opt.reason);
    } finally {
      setSnoozing(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={snoozing}>
            <Clock className="h-4 w-4" />
            {!compact && <span className="hidden sm:inline">Snooze</span>}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {options.map((opt) => (
            <DropdownMenuItem key={opt.reason} onClick={() => handleQuick(opt)}>
              <div className="flex w-full items-center justify-between">
                <span>{opt.label}</span>
                <span className="text-xs text-muted-foreground">{opt.sublabel}</span>
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCustomOpen(true)}>
            Custom...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SnoozeCustomModal
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        onSnooze={onSnooze}
        aiContextSuggestion={aiContextSuggestion}
        loadingAiSuggestion={loadingAiSuggestion}
      />
    </>
  );
}
