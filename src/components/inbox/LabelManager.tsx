import { useState } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { Label } from "@/hooks/useLabels";

interface LabelManagerProps {
  labels: Label[];
  onCreateLabel: (name: string, color: string) => Promise<Label | null>;
  onUpdateLabel: (id: string, updates: { name?: string; color?: string }) => Promise<void>;
  onDeleteLabel: (id: string) => Promise<void>;
}

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

export default function LabelManager({
  labels,
  onCreateLabel,
  onUpdateLabel,
  onDeleteLabel,
}: LabelManagerProps) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[4]);
  const [creating, setCreating] = useState(false);

  const startEdit = (label: Label) => {
    setEditingId(label.id);
    setEditName(label.name);
    setEditColor(label.color);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    try {
      await onUpdateLabel(editingId, { name: editName.trim(), color: editColor });
      setEditingId(null);
    } catch {
      toast({ title: "Failed to update label", variant: "destructive" });
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await onCreateLabel(newName.trim(), newColor);
      setNewName("");
      setCreating(false);
      toast({ title: "Label created" });
    } catch {
      toast({ title: "Failed to create label", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await onDeleteLabel(id);
      toast({ title: "Label deleted" });
    } catch {
      toast({ title: "Failed to delete label", variant: "destructive" });
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Labels</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Labels</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {labels.length === 0 && !creating && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No labels yet. Create one to start organizing your emails.
            </p>
          )}
          {labels.map((label) =>
            editingId === label.id ? (
              <div key={label.id} className="space-y-2 rounded-lg border border-border p-3">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                  className="h-8 text-sm"
                  autoFocus
                />
                <div className="flex items-center gap-1">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setEditColor(c)}
                      className={`h-5 w-5 rounded-full border-2 transition-transform ${
                        editColor === c ? "border-foreground scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" className="h-7 text-xs" onClick={saveEdit}>
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div
                key={label.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/30 transition-colors"
              >
                <div
                  className="h-3.5 w-3.5 rounded-full shrink-0"
                  style={{ backgroundColor: label.color }}
                />
                <span className="flex-1 text-sm text-foreground">{label.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => startEdit(label)}
                >
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleDelete(label.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            )
          )}
        </div>

        {creating ? (
          <div className="space-y-2 border-t border-border pt-3">
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
              <Button size="sm" className="h-7 text-xs" onClick={handleCreate}>
                Create
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
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setCreating(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            New Label
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
