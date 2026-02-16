import { useVoiceBriefing } from "@/hooks/useVoiceBriefing";
import { Button } from "@/components/ui/button";
import { Pause, Play, Square, Volume2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function VoiceMiniPlayer() {
  const { state, progress, pause, resume, stop } = useVoiceBriefing();

  if (state === "idle") return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm shadow-lg">
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-2.5">
        {/* Sound wave animation */}
        <div className="flex items-center gap-1">
          <Volume2 className="h-4 w-4 text-primary" />
          {state === "playing" && (
            <div className="flex items-end gap-0.5 h-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-0.5 bg-primary rounded-full animate-pulse"
                  style={{
                    height: `${8 + Math.random() * 8}px`,
                    animationDelay: `${i * 0.15}s`,
                    animationDuration: "0.6s",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <span className="text-xs font-medium text-foreground whitespace-nowrap">
          {state === "playing" ? "Playing Briefing..." : "Paused"}
        </span>

        <Progress value={progress} className="h-1.5 flex-1" />

        <div className="flex items-center gap-1">
          {state === "playing" ? (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={pause}>
              <Pause className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resume}>
              <Play className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={stop}>
            <Square className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
