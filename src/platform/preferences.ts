"use client";

import { useEffect, useState } from "react";

const DISPLAY_PREFERENCES_KEY = "dino-park-engineer:display-preferences";

export interface DisplayPreferences {
  readonly reducedMotion: boolean;
}

const DEFAULT_PREFERENCES: DisplayPreferences = Object.freeze({ reducedMotion: false });

function readPreferences(): DisplayPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const stored = window.localStorage.getItem(DISPLAY_PREFERENCES_KEY);
    if (!stored) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(stored) as Partial<DisplayPreferences>;
    return { reducedMotion: parsed.reducedMotion === true };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function useDisplayPreferences(): {
  readonly preferences: DisplayPreferences;
  readonly setReducedMotion: (value: boolean) => void;
} {
  const [preferences, setPreferences] = useState<DisplayPreferences>(readPreferences);

  useEffect(() => {
    try {
      window.localStorage.setItem(DISPLAY_PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
      // Display preferences are best-effort and never block the product frame.
    }
  }, [preferences]);

  const setReducedMotion = (value: boolean) => setPreferences({ reducedMotion: value });

  return { preferences, setReducedMotion };
}

export { DISPLAY_PREFERENCES_KEY };
