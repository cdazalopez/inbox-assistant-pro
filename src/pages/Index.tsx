import { Mail, Sparkles } from "lucide-react";

const Index = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
          <Mail className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-3">
          <h1 className="text-5xl font-bold tracking-tight text-foreground">
            Inbox Agent
          </h1>
          <p className="flex items-center gap-2 text-lg text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            AI-Powered Email Assistant for Healthcare Professionals
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
