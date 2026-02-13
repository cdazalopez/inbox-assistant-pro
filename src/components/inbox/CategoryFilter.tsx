import { ALL_CATEGORIES, CATEGORY_COLORS } from "./types";

interface CategoryFilterProps {
  selected: string | null;
  onChange: (cat: string | null) => void;
}

export default function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2">
      <button
        onClick={() => onChange(null)}
        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
          selected === null
            ? "border-primary bg-primary/20 text-primary"
            : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
        }`}
      >
        All Categories
      </button>
      {ALL_CATEGORIES.map((cat) => {
        const isActive = selected === cat;
        const colors = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.general;
        return (
          <button
            key={cat}
            onClick={() => onChange(isActive ? null : cat)}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize transition-colors ${
              isActive ? colors : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
            }`}
          >
            {cat}
          </button>
        );
      })}
    </div>
  );
}
