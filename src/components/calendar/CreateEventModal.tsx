import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { X, Loader2, Calendar } from "lucide-react";

interface CreateEventModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    description?: string;
    location?: string;
    start_time: string;
    end_time: string;
    all_day?: boolean;
  }) => Promise<void>;
  initialDate?: Date;
  initialHour?: number;
}

export default function CreateEventModal({
  open,
  onClose,
  onSave,
  initialDate,
  initialHour,
}: CreateEventModalProps) {
  const defaultDate = initialDate ?? new Date();
  const defaultHour = initialHour ?? 9;

  const startDefault = new Date(defaultDate);
  startDefault.setHours(defaultHour, 0, 0, 0);
  const endDefault = new Date(startDefault.getTime() + 60 * 60000);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startTime, setStartTime] = useState(format(startDefault, "yyyy-MM-dd'T'HH:mm"));
  const [endTime, setEndTime] = useState(format(endDefault, "yyyy-MM-dd'T'HH:mm"));
  const [allDay, setAllDay] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const startISO = allDay
        ? new Date(startTime.split("T")[0] + "T00:00:00").toISOString()
        : new Date(startTime).toISOString();
      const endISO = allDay
        ? new Date(endTime.split("T")[0] + "T23:59:59").toISOString()
        : new Date(endTime).toISOString();

      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        start_time: startISO,
        end_time: endISO,
        all_day: allDay,
      });
      // Reset form
      setTitle("");
      setDescription("");
      setLocation("");
      setAllDay(false);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">New Event</h3>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="event-title">Title *</Label>
            <Input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Meeting with…"
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="event-location">Location</Label>
            <Input
              id="event-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Zoom, Room 3B, etc."
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch id="all-day" checked={allDay} onCheckedChange={setAllDay} />
            <Label htmlFor="all-day" className="cursor-pointer">All day</Label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="event-start">Start</Label>
              <Input
                id="event-start"
                type={allDay ? "date" : "datetime-local"}
                value={allDay ? startTime.split("T")[0] : startTime}
                onChange={(e) => setStartTime(allDay ? e.target.value + "T00:00" : e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="event-end">End</Label>
              <Input
                id="event-end"
                type={allDay ? "date" : "datetime-local"}
                value={allDay ? endTime.split("T")[0] : endTime}
                onChange={(e) => setEndTime(allDay ? e.target.value + "T23:59" : e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="event-description">Description</Label>
            <Textarea
              id="event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes…"
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={saving || !title.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Event
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
