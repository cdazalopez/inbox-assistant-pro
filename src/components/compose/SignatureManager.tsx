import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FileSignature, Plus, Trash2, Check } from "lucide-react";

export interface Signature {
  id: string;
  name: string;
  html: string;
}

const STORAGE_KEY = "inbox-agent-signatures";
const ACTIVE_KEY = "inbox-agent-active-signature";

export function loadSignatures(): Signature[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function getActiveSignatureId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function getActiveSignatureHtml(): string {
  const sigs = loadSignatures();
  const activeId = getActiveSignatureId();
  if (!activeId) return "";
  const sig = sigs.find((s) => s.id === activeId);
  return sig ? `<br/><br/>--<br/>${sig.html}` : "";
}

export default function SignatureManager() {
  const [signatures, setSignatures] = useState<Signature[]>(loadSignatures);
  const [activeId, setActiveId] = useState<string | null>(getActiveSignatureId);
  const [newName, setNewName] = useState("");
  const [newBody, setNewBody] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(signatures));
  }, [signatures]);

  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
    else localStorage.removeItem(ACTIVE_KEY);
  }, [activeId]);

  const addSignature = () => {
    if (!newName.trim()) return;
    const sig: Signature = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      html: newBody.trim().replace(/\n/g, "<br/>"),
    };
    setSignatures((prev) => [...prev, sig]);
    setActiveId(sig.id);
    setNewName("");
    setNewBody("");
  };

  const deleteSig = (id: string) => {
    setSignatures((prev) => prev.filter((s) => s.id !== id));
    if (activeId === id) setActiveId(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Signatures">
          <FileSignature className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="start">
        <p className="text-sm font-medium text-foreground">Email Signatures</p>
        {signatures.length === 0 && (
          <p className="text-xs text-muted-foreground">No signatures yet.</p>
        )}
        {signatures.map((sig) => (
          <div key={sig.id} className="flex items-center gap-2">
            <Button
              variant={activeId === sig.id ? "default" : "outline"}
              size="sm"
              className="flex-1 justify-start text-xs h-7"
              onClick={() => setActiveId(activeId === sig.id ? null : sig.id)}
            >
              {activeId === sig.id && <Check className="h-3 w-3 mr-1" />}
              {sig.name}
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteSig(sig.id)}>
              <Trash2 className="h-3 w-3 text-muted-foreground" />
            </Button>
          </div>
        ))}
        <div className="space-y-2 border-t border-border pt-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Signature name"
            className="h-7 text-xs"
          />
          <Textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder="Best regards,&#10;Your Name&#10;Company"
            className="min-h-[60px] text-xs resize-none"
          />
          <Button size="sm" className="h-7 w-full text-xs" onClick={addSignature} disabled={!newName.trim()}>
            <Plus className="h-3 w-3" />
            Add Signature
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
