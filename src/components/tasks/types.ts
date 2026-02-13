export interface Task {
  id: string;
  email_id?: string;
  title: string;
  description?: string;
  due_date?: string;
  priority: "high" | "medium" | "low";
  status: "todo" | "in_progress" | "done";
  created_at: string;
  updated_at: string;
  completed_at?: string;
  email_subject?: string;
  email_from?: string;
}

export interface Followup {
  id: string;
  email_id?: string;
  type: "reply_needed" | "waiting_response" | "check_in" | "deadline";
  due_date: string;
  status: "pending" | "completed";
  reminder_sent?: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  email_subject?: string;
  email_from?: string;
}

export const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/20 text-red-400 border-red-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

export const FOLLOWUP_TYPE_COLORS: Record<string, string> = {
  reply_needed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  waiting_response: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  check_in: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  deadline: "bg-red-500/20 text-red-400 border-red-500/30",
};

export const FOLLOWUP_TYPE_LABELS: Record<string, string> = {
  reply_needed: "Reply Needed",
  waiting_response: "Waiting for Response",
  check_in: "Check In",
  deadline: "Deadline",
};
