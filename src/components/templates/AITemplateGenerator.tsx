import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onClose: () => void;
  onGenerated: (data: { name: string; category: string; subject_template: string; body_template: string; tone: string }) => void;
}

export default function AITemplateGenerator({ open, onClose, onGenerated }: Props) {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-draft", {
        body: {
          isReply: false,
          tone: "professional",
          context: `Generate a reusable email template for: "${prompt}". Use placeholders like {patient_name}, {date}, {time}, {doctor_name}, {clinic_name}, {phone}, {amount}, {sender_name} where appropriate. The template should be professional and suitable for a healthcare practice. Return a generalized template, not a specific email.`,
          templateMode: true,
        },
      });
      if (error) throw error;

      // Infer category from prompt
      const lp = prompt.toLowerCase();
      let category = "general";
      if (lp.includes("appointment") || lp.includes("schedule") || lp.includes("reschedule")) category = "scheduling";
      else if (lp.includes("bill") || lp.includes("invoice") || lp.includes("payment") || lp.includes("insurance")) category = "billing";
      else if (lp.includes("follow") || lp.includes("check in")) category = "follow-up";

      onGenerated({
        name: prompt.charAt(0).toUpperCase() + prompt.slice(1),
        category,
        subject_template: data?.subject ?? `Re: ${prompt}`,
        body_template: data?.body?.replace(/<[^>]*>/g, "") ?? "",
        tone: "professional",
      });
      setPrompt("");
      onClose();
    } catch {
      // fallback silent
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> AI Template Generator</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>What kind of emails do you want a template for?</Label>
            <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. appointment confirmations, insurance follow-ups" onKeyDown={(e) => e.key === "Enter" && handleGenerate()} />
          </div>
          <p className="text-xs text-muted-foreground">
            AI will generate a professional template with appropriate placeholders for your use case.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={generating || !prompt.trim()}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
