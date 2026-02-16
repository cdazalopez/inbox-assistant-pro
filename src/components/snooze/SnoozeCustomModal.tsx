import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface SnoozeCustomModalProps {
  open: boolean;
  onClose: () => void;
  onSnooze: (wakeAt: string, reason: string, contextNote?: string) => Promise<void>;
  aiContextSuggestion?: string | null;
  loadingAiSuggestion?: boolean;
}

export default function SnoozeCustomModal({
  open,
  onClose,
  onSnooze,
  aiContextSuggestion,
  loadingAiSuggestion,
}: SnoozeCustomModalProps) {
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState("09:00");
  const [contextNote, setContextNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Pre-fill AI suggestion
  useEffect(() => {
    if (aiContextSuggestion && !contextNote) {
      setContextNote(aiContextSuggestion);
    }
  }, [aiContextSuggestion]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setDate(undefined);
      setTime("09:00");
      setContextNote(aiContextSuggestion || "");
    }
  }, [open]);

  const handleSave = async () => {
    if (!date) return;
    const [h, m] = time.split(":").map(Number);
    const wakeAt = new Date(date);
    wakeAt.setHours(h, m, 0, 0);
    setSaving(true);
    try {
      await onSnooze(wakeAt.toISOString(), "custom", contextNote || undefined);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Custom Snooze</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {date ? format(date, "MMM d, yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(d) => d < new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Time</label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              Context note
              {loadingAiSuggestion && (
                <span className="ml-2 text-xs text-muted-foreground">
                  <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                  Generating suggestion...
                </span>
              )}
            </label>
            <Textarea
              placeholder='Remind me to... e.g. "Reply after getting info from Dr. Smith"'
              value={contextNote}
              onChange={(e) => setContextNote(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!date || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Snooze
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
