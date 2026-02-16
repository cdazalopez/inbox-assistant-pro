import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { awsApi } from "@/lib/awsApi";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getInitials,
  getAvatarColor,
  getSentimentDotColor,
  getSentimentTrendDirection,
  ContactProfile,
} from "./types";
import { format } from "date-fns";

interface Props {
  email: string;
  name?: string;
}

export default function ContactCompactCard({ email, name }: Props) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ContactProfile | null>(null);

  useEffect(() => {
    if (!user?.id || !email) return;
    awsApi.getContactProfile(user.id, email).then(setProfile).catch(() => {});
  }, [user?.id, email]);

  if (!profile) return null;

  const initials = getInitials(name || email);
  const avatarColor = getAvatarColor(name || email);
  const trendDir = getSentimentTrendDirection(profile.sentiment_trend ?? []);
  const lastSentiment = profile.sentiment_trend?.length
    ? profile.sentiment_trend[profile.sentiment_trend.length - 1]
    : "neutral";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1">
          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColor}`}>
            {initials}
          </div>
          <span className="text-xs text-foreground/80 truncate max-w-[120px]">{profile.name || email}</span>
          <span className="text-[10px] text-muted-foreground">{profile.total_emails} emails</span>
          <div className={`h-2 w-2 rounded-full ${getSentimentDotColor(lastSentiment)}`} />
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <p className="text-xs">
          You've exchanged <strong>{profile.total_emails}</strong> emails with this contact.
          Last interaction: <strong>{profile.last_contact ? format(new Date(profile.last_contact), "MMM d, yyyy") : "Unknown"}</strong>.
          Tone trend: <strong className="capitalize">{trendDir}</strong>
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
