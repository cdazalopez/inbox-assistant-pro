import type { Label } from "@/hooks/useLabels";

interface LabelFilterProps {
  labels: Label[];
  selectedLabelId: string | null;
  onChange: (labelId: string | null) => void;
}

export default function LabelFilter({ labels, selectedLabelId, onChange }: LabelFilterProps) {
  if (labels.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2">
      <span className="text-xs text-muted-foreground mr-1">Labels:</span>
      <button
        onClick={() => onChange(null)}
        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
          selectedLabelId === null
            ? "border-primary bg-primary/20 text-primary"
            : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
        }`}
      >
        All
      </button>
      {labels.map((label) => {
        const isActive = selectedLabelId === label.id;
        return (
          <button
            key={label.id}
            onClick={() => onChange(isActive ? null : label.id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
              isActive
                ? "border-current text-foreground"
                : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
            }`}
          >
            <div
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: label.color }}
            />
            {label.name}
          </button>
        );
      })}
    </div>
  );
}
