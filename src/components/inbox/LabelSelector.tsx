import { useState } from "react";
import { Check, Plus, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import type { Label } from "@/hooks/useLabels";

interface LabelSelectorProps {
  labels: Label[];
  activeLabelsIds: string[];
  onToggle: (labelId: string) => void;
  onCreateLabel: (name: string, color: string) => Promise<Label | null>;
  triggerVariant?: "icon" | "badge";
}

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

export default function LabelSelector({
  labels,
  activeLabelsIds,
  onToggle,
  onCreateLabel,
  triggerVariant = "icon",
}: LabelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[4]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const label = await onCreateLabel(newName.trim(), newColor);
    if (label) {
      onToggle(label.id);
    }
    setNewName("");
    setCreating(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {triggerVariant === "icon" ? (
          <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </Button>
        ) : (
          <button
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/40 px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Plus className="h-2.5 w-2.5" />
            Label
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-2"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1">
          <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Labels</p>
          {labels.length === 0 && !creating && (
            <p className="px-2 py-2 text-xs text-muted-foreground">No labels yet</p>
          )}
          {labels.map((label) => {
            const isActive = activeLabelsIds.includes(label.id);
            return (
              <button
                key={label.id}
                onClick={() => onToggle(label.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-muted/50 transition-colors"
              >
                <div
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: label.color }}
                />
                <span className="truncate flex-1 text-left">{label.name}</span>
                {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
              </button>
            );
          })}

          {creating ? (
            <div className="space-y-2 border-t border-border pt-2 mt-1">
              <Input
                placeholder="Label name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="h-8 text-sm"
                autoFocus
              />
              <div className="flex items-center gap-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={`h-5 w-5 rounded-full border-2 transition-transform ${
                      newColor === c ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex gap-1">
                <Button size="sm" className="h-7 flex-1 text-xs" onClick={handleCreate}>
                  Add
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => {
                    setCreating(false);
                    setNewName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground border-t border-border mt-1 pt-2 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Create new label
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
