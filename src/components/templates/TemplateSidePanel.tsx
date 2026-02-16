import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, X } from "lucide-react";
import type { EmailTemplate } from "./types";
import { getCategoryStyle } from "./types";

interface Props {
  templates: EmailTemplate[];
  emailCategory?: string;
  onUse: (template: EmailTemplate) => void;
  onClose: () => void;
}

export default function TemplateSidePanel({ templates, emailCategory, onUse, onClose }: Props) {
  const sorted = useMemo(() => {
    const copy = [...templates];
    if (emailCategory) {
      copy.sort((a, b) => {
        const aMatch = a.category === emailCategory ? -1 : 0;
        const bMatch = b.category === emailCategory ? -1 : 0;
        return aMatch - bMatch || b.use_count - a.use_count;
      });
    } else {
      copy.sort((a, b) => b.use_count - a.use_count);
    }
    return copy;
  }, [templates, emailCategory]);

  if (sorted.length === 0) {
    return (
      <div className="border-t border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Templates</span>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="h-3.5 w-3.5" /></Button>
        </div>
        <p className="text-xs text-muted-foreground">No templates yet. Create one from the Templates page.</p>
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-muted/30 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Templates</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="h-3.5 w-3.5" /></Button>
      </div>
      <ScrollArea className="max-h-48">
        <div className="space-y-2">
          {sorted.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-md border border-border bg-background/50 p-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{t.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="outline" className={`text-[10px] h-4 ${getCategoryStyle(t.category)}`}>{t.category}</Badge>
                  <span className="text-[10px] text-muted-foreground truncate">{t.subject_template}</span>
                </div>
              </div>
              <Button size="sm" variant="outline" className="ml-2 h-7 text-xs" onClick={() => onUse(t)}>Use</Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
