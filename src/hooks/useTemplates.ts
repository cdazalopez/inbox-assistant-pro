import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { awsApi } from "@/lib/awsApi";
import { useToast } from "@/hooks/use-toast";
import type { EmailTemplate } from "@/components/templates/types";

export function useTemplates() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await awsApi.getTemplates(user.id);
      setTemplates(Array.isArray(data) ? data : []);
    } catch {
      console.error("Failed to fetch templates");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const createTemplate = useCallback(async (params: {
    name: string; category: string; subject_template: string; body_template: string; tone: string;
  }) => {
    if (!user?.id) return;
    try {
      await awsApi.createTemplate({ user_id: user.id, ...params });
      toast({ title: "Template created" });
      fetchTemplates();
    } catch {
      toast({ title: "Failed to create template", variant: "destructive" });
    }
  }, [user?.id, toast, fetchTemplates]);

  const updateTemplate = useCallback(async (templateId: string, params: {
    name?: string; category?: string; subject_template?: string; body_template?: string; tone?: string; increment_use?: boolean;
  }) => {
    if (!user?.id) return;
    try {
      await awsApi.updateTemplate({ template_id: templateId, user_id: user.id, ...params });
      if (!params.increment_use) toast({ title: "Template updated" });
      fetchTemplates();
    } catch {
      toast({ title: "Failed to update template", variant: "destructive" });
    }
  }, [user?.id, toast, fetchTemplates]);

  const deleteTemplate = useCallback(async (templateId: string) => {
    if (!user?.id) return;
    try {
      await awsApi.deleteTemplate(templateId, user.id);
      toast({ title: "Template deleted" });
      fetchTemplates();
    } catch {
      toast({ title: "Failed to delete template", variant: "destructive" });
    }
  }, [user?.id, toast, fetchTemplates]);

  const trackUsage = useCallback(async (templateId: string) => {
    if (!user?.id) return;
    try {
      await awsApi.updateTemplate({ template_id: templateId, user_id: user.id, increment_use: true });
      fetchTemplates();
    } catch { /* silent */ }
  }, [user?.id, fetchTemplates]);

  return { templates, loading, fetchTemplates, createTemplate, updateTemplate, deleteTemplate, trackUsage };
}
