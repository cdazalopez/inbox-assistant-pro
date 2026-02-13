export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  all_day: boolean;
  status?: string;
  busy?: boolean;
  participants?: { name?: string; email: string; status?: string }[];
  organizer?: { name?: string; email: string };
  html_link?: string;
  calendar_id?: string;
}

export interface CalendarResponse {
  events: CalendarEvent[];
  total: number;
  account_email?: string;
  calendar_name?: string;
  range?: { start: string; end: string };
}

const MEETING_KEYWORDS = /\b(meeting|call|appointment|schedule|zoom|teams|webex|hangout|standup|sync|check-in|demo|interview|review|1:1|one-on-one)\b/i;

export function isMeetingEmail(subject: string, category?: string): boolean {
  if (category === "meeting" || category === "scheduling") return true;
  return MEETING_KEYWORDS.test(subject);
}
