import { Email, EmailAnalysis } from "@/components/inbox/types";

export interface SmartSuggestion {
  id: string;
  type: "bulk_archive" | "reply_urgent" | "review_risk" | "follow_up" | "group_sender";
  icon: "archive" | "reply" | "alert" | "clock" | "users";
  title: string;
  description: string;
  priority: number; // 1 = highest
  emailIds: string[];
  action?: string;
}

interface SuggestionInput {
  emails: Email[];
  analysesMap: Record<string, EmailAnalysis>;
  unreadIds?: Set<string>;
}

export function generateSuggestions({ emails, analysesMap, unreadIds }: SuggestionInput): SmartSuggestion[] {
  const suggestions: SmartSuggestion[] = [];

  // 1. Risk-based: legal threats
  const legalEmails = emails.filter((e) => {
    const a = analysesMap[e.id];
    return a?.risk_flags?.includes("legal_threat");
  });
  if (legalEmails.length > 0) {
    suggestions.push({
      id: "risk_legal",
      type: "review_risk",
      icon: "alert",
      title: `Review ${legalEmails.length} legal threat${legalEmails.length > 1 ? "s" : ""}`,
      description: "Emails flagged with legal risk need immediate attention",
      priority: 1,
      emailIds: legalEmails.map((e) => e.id),
    });
  }

  // 2. Risk-based: deadlines
  const deadlineEmails = emails.filter((e) => {
    const a = analysesMap[e.id];
    return a?.risk_flags?.includes("deadline_approaching") || a?.risk_flags?.includes("deadline");
  });
  if (deadlineEmails.length > 0) {
    suggestions.push({
      id: "risk_deadline",
      type: "review_risk",
      icon: "clock",
      title: `${deadlineEmails.length} email${deadlineEmails.length > 1 ? "s" : ""} with approaching deadlines`,
      description: "Don't miss these time-sensitive items",
      priority: 2,
      emailIds: deadlineEmails.map((e) => e.id),
    });
  }

  // 3. Urgent emails needing reply
  const urgentUnread = emails.filter((e) => {
    const a = analysesMap[e.id];
    return a && a.urgency >= 4 && (!unreadIds || unreadIds.has(e.id));
  });
  if (urgentUnread.length > 0) {
    suggestions.push({
      id: "reply_urgent",
      type: "reply_urgent",
      icon: "reply",
      title: `Reply to ${urgentUnread.length} urgent email${urgentUnread.length > 1 ? "s" : ""}`,
      description: "High-urgency emails that may need a response",
      priority: 3,
      emailIds: urgentUnread.map((e) => e.id),
    });
  }

  // 4. Emails requiring response
  const needResponse = emails.filter((e) => {
    const a = analysesMap[e.id];
    return a?.requires_response && (!unreadIds || unreadIds.has(e.id));
  });
  if (needResponse.length > 0) {
    suggestions.push({
      id: "follow_up",
      type: "follow_up",
      icon: "reply",
      title: `${needResponse.length} email${needResponse.length > 1 ? "s" : ""} need a response`,
      description: "AI detected these emails expect a reply from you",
      priority: 4,
      emailIds: needResponse.map((e) => e.id),
    });
  }

  // 5. Bulk archive marketing
  const marketingEmails = emails.filter((e) => {
    const a = analysesMap[e.id];
    return a?.category === "marketing" && a.urgency <= 2;
  });
  if (marketingEmails.length >= 3) {
    suggestions.push({
      id: "bulk_archive_marketing",
      type: "bulk_archive",
      icon: "archive",
      title: `Archive ${marketingEmails.length} marketing emails`,
      description: "Low-priority promotional emails cluttering your inbox",
      priority: 5,
      emailIds: marketingEmails.map((e) => e.id),
      action: "archive",
    });
  }

  // 6. Group by frequent sender (top sender with 3+ emails)
  const senderCounts = new Map<string, Email[]>();
  for (const e of emails) {
    const key = e.from_address;
    if (!senderCounts.has(key)) senderCounts.set(key, []);
    senderCounts.get(key)!.push(e);
  }
  const topSender = [...senderCounts.entries()]
    .filter(([, list]) => list.length >= 3)
    .sort((a, b) => b[1].length - a[1].length)[0];

  if (topSender) {
    const [address, senderEmails] = topSender;
    const name = senderEmails[0].from_name || address;
    suggestions.push({
      id: `group_${address}`,
      type: "group_sender",
      icon: "users",
      title: `${senderEmails.length} emails from ${name}`,
      description: "Review or batch-process emails from this sender",
      priority: 6,
      emailIds: senderEmails.map((e) => e.id),
    });
  }

  // 7. Payment issue risk flags
  const paymentEmails = emails.filter((e) => {
    const a = analysesMap[e.id];
    return a?.risk_flags?.includes("payment_issue");
  });
  if (paymentEmails.length > 0) {
    suggestions.push({
      id: "risk_payment",
      type: "review_risk",
      icon: "alert",
      title: `${paymentEmails.length} payment issue${paymentEmails.length > 1 ? "s" : ""} flagged`,
      description: "Review emails with billing or payment concerns",
      priority: 2,
      emailIds: paymentEmails.map((e) => e.id),
    });
  }

  // Sort by priority and return top suggestions
  return suggestions.sort((a, b) => a.priority - b.priority);
}
