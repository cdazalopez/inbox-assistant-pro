import { SmartSuggestion } from "@/services/smartSuggestions";
import { Button } from "@/components/ui/button";
import {
  Archive,
  Reply,
  AlertTriangle,
  Clock,
  Users,
  ChevronRight,
  Lightbulb,
} from "lucide-react";

const ICON_MAP = {
  archive: Archive,
  reply: Reply,
  alert: AlertTriangle,
  clock: Clock,
  users: Users,
};

const ICON_ACCENT = {
  archive: "bg-muted text-muted-foreground",
  reply: "bg-blue-500/10 text-blue-400",
  alert: "bg-red-500/10 text-red-400",
  clock: "bg-yellow-500/10 text-yellow-400",
  users: "bg-purple-500/10 text-purple-400",
};

interface SuggestionCardProps {
  suggestions: SmartSuggestion[];
  onAction: (suggestion: SmartSuggestion) => void;
  maxItems?: number;
}

export default function SuggestionCard({ suggestions, onAction, maxItems = 5 }: SuggestionCardProps) {
  const visible = suggestions.slice(0, maxItems);

  if (visible.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <Lightbulb className="h-4 w-4 text-yellow-400" />
        <h2 className="text-sm font-semibold text-foreground">Things to Handle Today</h2>
      </div>
      <div className="divide-y divide-border">
        {visible.map((s) => {
          const Icon = ICON_MAP[s.icon];
          const accent = ICON_ACCENT[s.icon];
          return (
            <button
              key={s.id}
              onClick={() => onAction(s)}
              className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/30"
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${accent}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{s.title}</p>
                <p className="text-xs text-muted-foreground truncate">{s.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
