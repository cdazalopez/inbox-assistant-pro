import { SmartSuggestion } from "@/services/smartSuggestions";
import { Button } from "@/components/ui/button";
import {
  Archive,
  Reply,
  AlertTriangle,
  Clock,
  Users,
  Lightbulb,
  X,
} from "lucide-react";
import { useState } from "react";

const ICON_MAP = {
  archive: Archive,
  reply: Reply,
  alert: AlertTriangle,
  clock: Clock,
  users: Users,
};

interface InboxSuggestionBarProps {
  suggestions: SmartSuggestion[];
  onAction: (suggestion: SmartSuggestion) => void;
}

export default function InboxSuggestionBar({ suggestions, onAction }: InboxSuggestionBarProps) {
  const [dismissed, setDismissed] = useState(false);
  const top = suggestions.slice(0, 3);

  if (dismissed || top.length === 0) return null;

  return (
    <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-4 py-2 overflow-x-auto">
      <Lightbulb className="h-3.5 w-3.5 shrink-0 text-yellow-400" />
      <span className="text-xs font-medium text-muted-foreground shrink-0">Suggestions:</span>
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {top.map((s) => {
          const Icon = ICON_MAP[s.icon];
          return (
            <Button
              key={s.id}
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs shrink-0 whitespace-nowrap"
              onClick={() => onAction(s)}
            >
              <Icon className="h-3 w-3" />
              {s.title}
            </Button>
          );
        })}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="ml-auto h-6 w-6 shrink-0"
        onClick={() => setDismissed(true)}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
