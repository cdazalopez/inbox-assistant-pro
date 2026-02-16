import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Bot, Pause, Play, ShieldCheck } from "lucide-react";
import { AutopilotPrefs } from "@/hooks/useAutopilot";

interface AutopilotToggleProps {
  prefs: AutopilotPrefs;
  updatePrefs: (patch: Partial<AutopilotPrefs>) => void;
  pendingCount: number;
  onOpenQueue: () => void;
}

export default function AutopilotToggle({
  prefs,
  updatePrefs,
  pendingCount,
  onOpenQueue,
}: AutopilotToggleProps) {
  const [showExplainer, setShowExplainer] = useState(false);

  const handleToggle = (checked: boolean) => {
    if (checked && !prefs.hasSeenExplainer) {
      setShowExplainer(true);
      return;
    }
    updatePrefs({ enabled: checked, paused: false });
  };

  const handleConfirmEnable = () => {
    updatePrefs({ enabled: true, paused: false, hasSeenExplainer: true });
    setShowExplainer(false);
  };

  const isActive = prefs.enabled && !prefs.paused;

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Autopilot</span>
          <Switch checked={prefs.enabled} onCheckedChange={handleToggle} />
        </div>

        {prefs.enabled && (
          <>
            {isActive ? (
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
                Active
              </Badge>
            ) : (
              <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20">
                Paused
              </Badge>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => updatePrefs({ paused: !prefs.paused })}
              title={prefs.paused ? "Resume Autopilot" : "Pause Autopilot"}
            >
              {prefs.paused ? (
                <Play className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Pause className="h-3.5 w-3.5 text-yellow-400" />
              )}
            </Button>

            {pendingCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={onOpenQueue}
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {pendingCount}
                </span>
                Review Queue
              </Button>
            )}
          </>
        )}
      </div>

      {/* Explainer Modal */}
      <Dialog open={showExplainer} onOpenChange={setShowExplainer}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <DialogTitle>Enable Email Autopilot</DialogTitle>
            </div>
            <DialogDescription className="pt-2 space-y-3 text-sm">
              <p>
                Autopilot will automatically draft replies to low-risk emails — appointment
                confirmations, simple acknowledgments, and routine requests.
              </p>
              <p>
                You'll review and approve each draft before it's sent.{" "}
                <strong>Nothing sends without your approval.</strong>
              </p>
              <div className="flex items-start gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 mt-2">
                <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400" />
                <p className="text-xs text-emerald-300/90">
                  Emails with risk flags, legal content, billing disputes, and high-urgency
                  messages are always excluded from auto-drafting.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExplainer(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmEnable}>
              <Bot className="h-4 w-4" />
              Enable Autopilot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
