import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Bold, Italic, Underline, List, ListOrdered, Link } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const TOOLS = [
  { cmd: "bold", icon: Bold, label: "Bold (Ctrl+B)" },
  { cmd: "italic", icon: Italic, label: "Italic (Ctrl+I)" },
  { cmd: "underline", icon: Underline, label: "Underline (Ctrl+U)" },
  { cmd: "insertUnorderedList", icon: List, label: "Bullet list" },
  { cmd: "insertOrderedList", icon: ListOrdered, label: "Numbered list" },
] as const;

export default function RichTextToolbar() {
  const exec = useCallback((cmd: string) => {
    document.execCommand(cmd, false);
  }, []);

  const insertLink = useCallback(() => {
    const url = prompt("Enter URL:");
    if (url) document.execCommand("createLink", false, url);
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-0.5 border-b border-border px-4 py-1.5 bg-muted/20">
        {TOOLS.map(({ cmd, icon: Icon, label }) => (
          <Tooltip key={cmd}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onMouseDown={(e) => {
                  e.preventDefault();
                  exec(cmd);
                }}
              >
                <Icon className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
          </Tooltip>
        ))}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onMouseDown={(e) => {
                e.preventDefault();
                insertLink();
              }}
            >
              <Link className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Insert link</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
