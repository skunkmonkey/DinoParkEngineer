export const ACCESSIBILITY_DIAGNOSTIC_CODES = {
  INVALID_PREFERENCE: "SHELL_ACCESSIBILITY_PREFERENCE_INVALID",
} as const;

export interface AccessibilityPreferences {
  readonly reducedMotion: boolean;
  readonly highContrast: boolean;
  readonly textScale: number;
  readonly soundSubstitution: boolean;
}

export type AccessibilityPreferenceKey = keyof AccessibilityPreferences;

export interface AccessibilityPreferencesPort {
  readonly getSnapshot: () => AccessibilityPreferences;
  readonly setPreferences: (
    patch: Readonly<Partial<AccessibilityPreferences>>,
  ) => AccessibilityUpdateResult;
  readonly setPreference: <K extends AccessibilityPreferenceKey>(
    key: K,
    value: AccessibilityPreferences[K],
  ) => AccessibilityUpdateResult;
  readonly subscribe: (
    listener: (snapshot: AccessibilityPreferences) => void,
  ) => () => void;
}

export type AccessibilityUpdateResult =
  | { readonly ok: true; readonly snapshot: AccessibilityPreferences }
  | {
      readonly ok: false;
      readonly code: string;
      readonly message: string;
      readonly snapshot: AccessibilityPreferences;
    };

export const DEFAULT_ACCESSIBILITY_PREFERENCES: AccessibilityPreferences =
  Object.freeze({
    reducedMotion: false,
    highContrast: false,
    textScale: 1,
    soundSubstitution: false,
  });

export function createAccessibilityPreferencesPort(
  initial: Readonly<Partial<AccessibilityPreferences>> = {},
): AccessibilityPreferencesPort {
  let snapshot = DEFAULT_ACCESSIBILITY_PREFERENCES;
  const listeners = new Set<
    (nextSnapshot: AccessibilityPreferences) => void
  >();

  const setPreferences = (
    patch: Readonly<Partial<AccessibilityPreferences>>,
  ): AccessibilityUpdateResult => {
    const next = {
      ...snapshot,
      ...patch,
    };
    const validation = validatePreferences(next);
    if (!validation.ok) {
      return {
        ok: false,
        code: ACCESSIBILITY_DIAGNOSTIC_CODES.INVALID_PREFERENCE,
        message: validation.message,
        snapshot,
      };
    }

    snapshot = Object.freeze({ ...next });
    listeners.forEach((listener) => listener(snapshot));
    return { ok: true, snapshot };
  };

  const setPreference = <K extends AccessibilityPreferenceKey>(
    key: K,
    value: AccessibilityPreferences[K],
  ): AccessibilityUpdateResult => setPreferences({ [key]: value });

  const port: AccessibilityPreferencesPort = {
    getSnapshot: (): AccessibilityPreferences => snapshot,
    setPreferences,
    setPreference,
    subscribe: (
      listener: (nextSnapshot: AccessibilityPreferences) => void,
    ): (() => void) => {
      listeners.add(listener);
      return (): void => {
        listeners.delete(listener);
      };
    },
  };

  const initialResult = setPreferences(initial);
  if (!initialResult.ok) {
    throw new Error(initialResult.message);
  }

  return Object.freeze(port);
}

/** Alias used by provider composition where the shorter port name is clearer. */
export const createAccessibilityPort = createAccessibilityPreferencesPort;
export type AccessibilityPort = AccessibilityPreferencesPort;

function validatePreferences(
  preferences: AccessibilityPreferences,
): { readonly ok: true } | { readonly ok: false; readonly message: string } {
  if (typeof preferences.reducedMotion !== "boolean") {
    return { ok: false, message: "Reduced-motion preference must be boolean." };
  }

  if (typeof preferences.highContrast !== "boolean") {
    return { ok: false, message: "High-contrast preference must be boolean." };
  }

  if (
    typeof preferences.textScale !== "number" ||
    !Number.isFinite(preferences.textScale) ||
    preferences.textScale < 0.5 ||
    preferences.textScale > 3
  ) {
    return {
      ok: false,
      message: "Text scale must be a finite number between 0.5 and 3.",
    };
  }

  if (typeof preferences.soundSubstitution !== "boolean") {
    return {
      ok: false,
      message: "Sound-substitution preference must be boolean.",
    };
  }

  return { ok: true };
}
