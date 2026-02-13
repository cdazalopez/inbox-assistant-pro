import { Shield, CreditCard, Clock, MessageSquareWarning } from "lucide-react";

const FLAG_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  legal_threat: {
    label: "Legal",
    className: "bg-red-500/20 text-red-400 border-red-500/30",
    icon: <Shield className="h-2.5 w-2.5" />,
  },
  payment_issue: {
    label: "Payment",
    className: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    icon: <CreditCard className="h-2.5 w-2.5" />,
  },
  deadline: {
    label: "Deadline",
    className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    icon: <Clock className="h-2.5 w-2.5" />,
  },
  complaint: {
    label: "Complaint",
    className: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    icon: <MessageSquareWarning className="h-2.5 w-2.5" />,
  },
  security_breach_alert: {
    label: "Security",
    className: "bg-red-500/20 text-red-400 border-red-500/30",
    icon: <Shield className="h-2.5 w-2.5" />,
  },
  security_breach_potential: {
    label: "Security",
    className: "bg-red-500/20 text-red-400 border-red-500/30",
    icon: <Shield className="h-2.5 w-2.5" />,
  },
};

interface RiskFlagBadgesProps {
  flags: string[];
  size?: "sm" | "md";
}

export default function RiskFlagBadges({ flags, size = "sm" }: RiskFlagBadgesProps) {
  if (!flags || flags.length === 0) return null;

  const textSize = size === "sm" ? "text-[9px]" : "text-[10px]";
  const padding = size === "sm" ? "px-1 py-0" : "px-1.5 py-0.5";

  return (
    <>
      {flags.map((flag) => {
        const config = FLAG_CONFIG[flag];
        if (!config) return null;
        return (
          <span
            key={flag}
            className={`inline-flex shrink-0 items-center gap-0.5 rounded-full border ${padding} ${textSize} font-medium leading-3 ${config.className}`}
          >
            {config.icon}
            {config.label}
          </span>
        );
      })}
    </>
  );
}
