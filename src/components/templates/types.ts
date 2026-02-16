export interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  subject_template: string;
  body_template: string;
  tone: string;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export const TEMPLATE_CATEGORIES = [
  { value: "scheduling", label: "Scheduling", color: "bg-blue-500/20 text-blue-400" },
  { value: "billing", label: "Billing", color: "bg-green-500/20 text-green-400" },
  { value: "general", label: "General", color: "bg-gray-500/20 text-gray-400" },
  { value: "follow-up", label: "Follow-up", color: "bg-amber-500/20 text-amber-400" },
  { value: "custom", label: "Custom", color: "bg-purple-500/20 text-purple-400" },
] as const;

export const TONE_OPTIONS = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "firm", label: "Firm" },
  { value: "empathetic", label: "Empathetic" },
  { value: "concise", label: "Concise" },
] as const;

export const PLACEHOLDERS = [
  { label: "{patient_name}", desc: "Patient's full name" },
  { label: "{date}", desc: "Date (e.g., Jan 15, 2026)" },
  { label: "{time}", desc: "Time (e.g., 2:00 PM)" },
  { label: "{doctor_name}", desc: "Doctor's name" },
  { label: "{clinic_name}", desc: "Clinic/practice name" },
  { label: "{phone}", desc: "Phone number" },
  { label: "{amount}", desc: "Dollar amount" },
  { label: "{sender_name}", desc: "Original sender's name" },
] as const;

export function getCategoryStyle(category: string): string {
  return TEMPLATE_CATEGORIES.find((c) => c.value === category)?.color ?? "bg-muted text-muted-foreground";
}
