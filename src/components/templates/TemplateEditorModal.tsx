import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X } from "lucide-react";
import { TEMPLATE_CATEGORIES, TONE_OPTIONS, PLACEHOLDERS, type EmailTemplate } from "./types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; category: string; subject_template: string; body_template: string; tone: string }) => void;
  template?: EmailTemplate | null;
  initialData?: { name?: string; category?: string; subject_template?: string; body_template?: string; tone?: string };
}

export default function TemplateEditorModal({ open, onClose, onSave, template, initialData }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("general");
  const [tone, setTone] = useState("professional");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    if (template) {
      setName(template.name);
      setCategory(template.category);
      setTone(template.tone);
      setSubject(template.subject_template);
      setBody(template.body_template);
    } else if (initialData) {
      setName(initialData.name ?? "");
      setCategory(initialData.category ?? "general");
      setTone(initialData.tone ?? "professional");
      setSubject(initialData.subject_template ?? "");
      setBody(initialData.body_template ?? "");
    } else {
      setName(""); setCategory("general"); setTone("professional"); setSubject(""); setBody("");
    }
  }, [open, template, initialData]);

  const insertPlaceholder = (placeholder: string) => {
    const ta = bodyRef.current;
    if (!ta) { setBody((prev) => prev + placeholder); return; }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newBody = body.slice(0, start) + placeholder + body.slice(end);
    setBody(newBody);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + placeholder.length, start + placeholder.length); }, 0);
  };

  const handleSave = () => {
    if (!name.trim() || !subject.trim()) return;
    onSave({ name: name.trim(), category, subject_template: subject.trim(), body_template: body.trim(), tone });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Edit Template" : "New Template"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Template Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Appointment Confirmation" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEMPLATE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Re: Appointment for {patient_name} on {date}" />
          </div>
          <div className="space-y-1.5">
            <Label>Body</Label>
            <Textarea ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Dear {patient_name},&#10;&#10;Your appointment is confirmed for {date} at {time}..." rows={6} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Insert Placeholder</Label>
            <div className="flex flex-wrap gap-1.5">
              {PLACEHOLDERS.map((p) => (
                <Badge key={p.label} variant="outline" className="cursor-pointer hover:bg-primary/10 hover:border-primary/50 text-xs" onClick={() => insertPlaceholder(p.label)} title={p.desc}>
                  {p.label}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}><X className="h-4 w-4" /> Cancel</Button>
            <Button onClick={handleSave} disabled={!name.trim() || !subject.trim()}><Save className="h-4 w-4" /> Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
