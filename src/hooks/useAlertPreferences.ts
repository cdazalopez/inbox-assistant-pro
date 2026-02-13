import { useState, useCallback } from "react";

export interface AlertPreferences {
  showUrgentToasts: boolean;
  showRiskFlagToasts: boolean;
  urgencyThreshold: 3 | 4 | 5;
}

const STORAGE_KEY = "alert_preferences";

const defaults: AlertPreferences = {
  showUrgentToasts: true,
  showRiskFlagToasts: true,
  urgencyThreshold: 4,
};

function load(): AlertPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export function useAlertPreferences() {
  const [prefs, setPrefs] = useState<AlertPreferences>(load);

  const update = useCallback((partial: Partial<AlertPreferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { prefs, update };
}
