import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Label {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface EmailLabelAssignment {
  email_id: string;
  label_id: string;
}

export function useLabels() {
  const { user } = useAuth();
  const [labels, setLabels] = useState<Label[]>([]);
  const [emailLabelsMap, setEmailLabelsMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  const fetchLabels = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("labels")
      .select("*")
      .eq("user_id", user.id)
      .order("name");
    if (data) setLabels(data as Label[]);
  }, [user?.id]);

  const fetchEmailLabels = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("email_labels")
      .select("email_id, label_id")
      .eq("user_id", user.id);
    if (data) {
      const map: Record<string, string[]> = {};
      for (const row of data) {
        if (!map[row.email_id]) map[row.email_id] = [];
        map[row.email_id].push(row.label_id);
      }
      setEmailLabelsMap(map);
    }
  }, [user?.id]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchLabels(), fetchEmailLabels()]);
    setLoading(false);
  }, [fetchLabels, fetchEmailLabels]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createLabel = useCallback(
    async (name: string, color: string) => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("labels")
        .insert({ user_id: user.id, name, color })
        .select()
        .single();
      if (error) throw error;
      const label = data as Label;
      setLabels((prev) => [...prev, label].sort((a, b) => a.name.localeCompare(b.name)));
      return label;
    },
    [user?.id]
  );

  const updateLabel = useCallback(
    async (id: string, updates: { name?: string; color?: string }) => {
      const { error } = await supabase.from("labels").update(updates).eq("id", id);
      if (error) throw error;
      setLabels((prev) =>
        prev
          .map((l) => (l.id === id ? { ...l, ...updates } : l))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    },
    []
  );

  const deleteLabel = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("labels").delete().eq("id", id);
      if (error) throw error;
      setLabels((prev) => prev.filter((l) => l.id !== id));
      // Also clean up local email labels map
      setEmailLabelsMap((prev) => {
        const next = { ...prev };
        for (const emailId of Object.keys(next)) {
          next[emailId] = next[emailId].filter((lid) => lid !== id);
          if (next[emailId].length === 0) delete next[emailId];
        }
        return next;
      });
    },
    []
  );

  const toggleEmailLabel = useCallback(
    async (emailId: string, labelId: string) => {
      if (!user?.id) return;
      const currentLabels = emailLabelsMap[emailId] ?? [];
      const hasLabel = currentLabels.includes(labelId);

      if (hasLabel) {
        await supabase
          .from("email_labels")
          .delete()
          .eq("email_id", emailId)
          .eq("label_id", labelId);
        setEmailLabelsMap((prev) => {
          const next = { ...prev };
          next[emailId] = (next[emailId] ?? []).filter((lid) => lid !== labelId);
          if (next[emailId].length === 0) delete next[emailId];
          return next;
        });
      } else {
        await supabase
          .from("email_labels")
          .insert({ user_id: user.id, email_id: emailId, label_id: labelId });
        setEmailLabelsMap((prev) => ({
          ...prev,
          [emailId]: [...(prev[emailId] ?? []), labelId],
        }));
      }
    },
    [user?.id, emailLabelsMap]
  );

  const getLabelsForEmail = useCallback(
    (emailId: string): Label[] => {
      const labelIds = emailLabelsMap[emailId] ?? [];
      return labels.filter((l) => labelIds.includes(l.id));
    },
    [labels, emailLabelsMap]
  );

  return {
    labels,
    emailLabelsMap,
    loading,
    createLabel,
    updateLabel,
    deleteLabel,
    toggleEmailLabel,
    getLabelsForEmail,
    refresh,
  };
}
