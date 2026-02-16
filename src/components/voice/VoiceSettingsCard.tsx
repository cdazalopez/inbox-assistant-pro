import { useEffect, useState } from "react";
import { useVoiceBriefing } from "@/hooks/useVoiceBriefing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Volume2 } from "lucide-react";

const SPEED_OPTIONS = [
  { value: "0.7", label: "Slow (0.7×)" },
  { value: "0.9", label: "Normal (0.9×)" },
  { value: "1.2", label: "Fast (1.2×)" },
];

export default function VoiceSettingsCard() {
  const { voicePrefs, updateVoicePrefs } = useVoiceBriefing();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length) setVoices(v);
    };
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Volume2 className="h-5 w-5 text-primary" />
          <CardTitle>Voice Briefing</CardTitle>
        </div>
        <CardDescription>Configure text-to-speech for daily briefings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Voice selector */}
        <div className="space-y-2">
          <Label>Voice</Label>
          <Select
            value={voicePrefs.voiceURI ?? "default"}
            onValueChange={(v) => updateVoicePrefs({ voiceURI: v === "default" ? null : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="System default" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">System default</SelectItem>
              {voices.map((v) => (
                <SelectItem key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Speed */}
        <div className="space-y-2">
          <Label>Speed</Label>
          <div className="flex gap-2">
            {SPEED_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateVoicePrefs({ speed: parseFloat(opt.value) })}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  voicePrefs.speed === parseFloat(opt.value)
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

        {/* Auto-play */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Auto-play briefing</Label>
            <p className="text-xs text-muted-foreground">Automatically play when briefing is generated</p>
          </div>
          <Switch
            checked={voicePrefs.autoPlay}
            onCheckedChange={(v) => updateVoicePrefs({ autoPlay: v })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
