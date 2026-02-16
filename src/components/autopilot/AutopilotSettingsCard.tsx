import { AutopilotPrefs } from "@/hooks/useAutopilot";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Bot } from "lucide-react";
import { DraftTone } from "@/services/aiDraftService";
import { ALL_CATEGORIES } from "@/components/inbox/types";

interface AutopilotSettingsCardProps {
  prefs: AutopilotPrefs;
  updatePrefs: (patch: Partial<AutopilotPrefs>) => void;
}

const TONE_OPTIONS: { value: DraftTone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "concise", label: "Concise" },
];

const URGENCY_OPTIONS: { value: 1 | 2 | 3; label: string }[] = [
  { value: 1, label: "1 (Very low only)" },
  { value: 2, label: "2 (Low and below)" },
  { value: 3, label: "3 (Medium and below)" },
];

const ALWAYS_EXCLUDED = ["legal", "billing", "personal"];

export default function AutopilotSettingsCard({ prefs, updatePrefs }: AutopilotSettingsCardProps) {
  const toggleCategory = (cat: string) => {
    if (ALWAYS_EXCLUDED.includes(cat)) return;
    const current = prefs.excludeCategories;
    const next = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];
    updatePrefs({ excludeCategories: next });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <CardTitle>Autopilot Preferences</CardTitle>
        </div>
        <CardDescription>
          Configure how AI auto-drafts replies to low-risk emails
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Default tone */}
        <div className="space-y-2">
          <Label>Default tone for auto-drafts</Label>
          <div className="flex gap-2">
            {TONE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => updatePrefs({ defaultTone: opt.value })}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  prefs.defaultTone === opt.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Max urgency */}
        <div className="space-y-2">
          <Label>Max urgency for auto-draft</Label>
          <p className="text-xs text-muted-foreground">
            Emails above this urgency level won't be auto-drafted
          </p>
          <div className="flex gap-2 pt-1">
            {URGENCY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => updatePrefs({ maxUrgency: opt.value })}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  prefs.maxUrgency === opt.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Excluded categories */}
        <div className="space-y-2">
          <Label>Categories to exclude</Label>
          <p className="text-xs text-muted-foreground">
            Legal, billing, and personal are always excluded
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            {ALL_CATEGORIES.map((cat) => {
              const isAlwaysExcluded = ALWAYS_EXCLUDED.includes(cat);
              const isExcluded = prefs.excludeCategories.includes(cat);
              return (
                <label
                  key={cat}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={isExcluded}
                    onCheckedChange={() => toggleCategory(cat)}
                    disabled={isAlwaysExcluded}
                  />
                  <span className={isAlwaysExcluded ? "text-muted-foreground" : ""}>
                    {cat}
                    {isAlwaysExcluded && " (locked)"}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Auto-draft on sync */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Auto-draft on sync</Label>
            <p className="text-xs text-muted-foreground">
              Generate drafts automatically when new emails arrive
            </p>
          </div>
          <Switch
            checked={prefs.autoDraftOnSync}
            onCheckedChange={(v) => updatePrefs({ autoDraftOnSync: v })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
