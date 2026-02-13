import { useState, useCallback } from "react";
import { generateDraft, type DraftTone } from "@/services/aiDraftService";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sparkles,
  Loader2,
  RefreshCw,
  Briefcase,
  Smile,
  Shield,
  Heart,
  Zap,
  Check,
  Pencil,
} from "lucide-react";

const TONES: {
  value: DraftTone;
  label: string;
  icon: typeof Briefcase;
  desc: string;
}[] = [
  { value: "professional", label: "Professional", icon: Briefcase, desc: "Formal and business-appropriate" },
  { value: "friendly", label: "Friendly", icon: Smile, desc: "Warm and approachable" },
  { value: "firm", label: "Firm", icon: Shield, desc: "Direct and assertive" },
  { value: "empathetic", label: "Empathetic", icon: Heart, desc: "Understanding and compassionate" },
  { value: "concise", label: "Concise", icon: Zap, desc: "Brief and to the point" },
];

interface AIDraftPanelProps {
  replyTo?: {
    from_name: string;
    from_address: string;
    subject: string;
    snippet: string;
    body?: string;
    received_at: string;
  };
  onApplyDraft: (body: string, subject?: string) => void;
  onApplyAndClose: (body: string, subject?: string) => void;
}

export default function AIDraftPanel({ replyTo, onApplyDraft, onApplyAndClose }: AIDraftPanelProps) {
  const { toast } = useToast();
  const [tone, setTone] = useState<DraftTone>("professional");
  const [aiContext, setAiContext] = useState("");
  const [generating, setGenerating] = useState(false);
  const [lastDraft, setLastDraft] = useState<{ body: string; subject?: string } | null>(null);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const draft = await generateDraft({
        originalEmail: replyTo
          ? {
              from: `${replyTo.from_name} <${replyTo.from_address}>`,
              subject: replyTo.subject,
              body: replyTo.body ?? replyTo.snippet,
              date: replyTo.received_at,
            }
          : undefined,
        tone,
        context: aiContext || undefined,
        isReply: !!replyTo,
      });
      setLastDraft({ body: draft.body, subject: draft.subject });
      toast({ title: "AI draft generated" });
    } catch (err: any) {
      toast({ title: err?.message || "Failed to generate draft", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }, [replyTo, tone, aiContext, toast]);

  return (
    <div className="border-t border-border bg-muted/30 px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">AI Draft Assistant</span>
      </div>

      {/* Tone selector */}
      <TooltipProvider delayDuration={200}>
        <div className="flex flex-wrap gap-1.5">
          {TONES.map((t) => {
            const Icon = t.icon;
            const selected = tone === t.value;
            return (
              <Tooltip key={t.value}>
                <TooltipTrigger asChild>
                  <Button
                    variant={selected ? "default" : "outline"}
                    size="sm"
                    className={`h-8 gap-1.5 rounded-full text-xs ${selected ? "" : "text-muted-foreground"}`}
                    onClick={() => setTone(t.value)}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t.label}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">{t.desc}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>

      {/* Context input */}
      <Input
        value={aiContext}
        onChange={(e) => setAiContext(e.target.value)}
        placeholder="Instructions: e.g. 'decline politely' or 'ask for invoice details'"
        className="text-sm"
      />

      {/* Generate / Quick Actions */}
      {lastDraft ? (
        <div className="space-y-2">
          <div className="rounded-md border border-border bg-background/50 p-3 text-sm text-foreground/80 max-h-32 overflow-y-auto"
            dangerouslySetInnerHTML={{ __html: lastDraft.body }}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => {
              onApplyAndClose(lastDraft.body, lastDraft.subject);
              setLastDraft(null);
            }}>
              <Check className="h-3.5 w-3.5" />
              Use This
            </Button>
            <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Regenerate
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              onApplyDraft(lastDraft.body, lastDraft.subject);
              setLastDraft(null);
            }}>
              <Pencil className="h-3.5 w-3.5" />
              Edit Before Using
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" onClick={handleGenerate} disabled={generating}>
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Draft
            </>
          )}
        </Button>
      )}
    </div>
  );
}
