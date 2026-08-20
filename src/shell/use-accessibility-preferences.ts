import { useContext, useSyncExternalStore } from "react";

import { AccessibilityContext } from "./accessibility-context.js";
import type { AccessibilityPreferences, AccessibilityPreferencesPort } from "./providers/accessibility.js";

export interface AccessibilityPreferencesProjection {
  readonly preferences: AccessibilityPreferences;
  readonly setPreferences: AccessibilityPreferencesPort["setPreferences"];
}

/** The single application-wide accessibility projection consumed by every route. */
export function useAccessibilityPreferences(): AccessibilityPreferencesProjection {
  const port = useContext(AccessibilityContext);
  const preferences = useSyncExternalStore(port.subscribe, port.getSnapshot, port.getSnapshot);
  return { preferences, setPreferences: port.setPreferences };
}
