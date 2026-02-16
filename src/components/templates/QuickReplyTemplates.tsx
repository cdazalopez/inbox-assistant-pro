import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Send } from "lucide-react";
import type { EmailTemplate } from "./types";
import { getCategoryStyle } from "./types";

interface Props {
  templates: EmailTemplate[];
  emailCategory?: string;
  onUseTemplate: (template: EmailTemplate) => void;
}

export default function QuickReplyTemplates({ templates, emailCategory, onUseTemplate }: Props) {
  const top3 = useMemo(() => {
    if (templates.length === 0) return [];
    const sorted = [...templates].sort((a, b) => {
      const aMatch = emailCategory && a.category === emailCategory ? -1 : 0;
      const bMatch = emailCategory && b.category === emailCategory ? -1 : 0;
      return aMatch - bMatch || b.use_count - a.use_count;
    });
    return sorted.slice(0, 3);
  }, [templates, emailCategory]);

  if (top3.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">Quick Reply with Template</span>
      </div>
      <div className="space-y-2">
        {top3.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-md border border-border bg-background/50 px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium truncate">{t.name}</span>
                <Badge variant="outline" className={`text-[10px] h-4 shrink-0 ${getCategoryStyle(t.category)}`}>{t.category}</Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{t.subject_template}</p>
            </div>
            <Button size="sm" variant="outline" className="ml-3 h-7 text-xs shrink-0" onClick={() => onUseTemplate(t)}>
              <Send className="h-3 w-3" /> Reply
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
