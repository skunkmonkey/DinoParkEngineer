import React from "react";

import { AccessibilityContext } from "./accessibility-context.js";
import type { AccessibilityPreferencesPort } from "./providers/accessibility.js";

export interface AccessibilityPreferencesProviderProps {
  readonly port: AccessibilityPreferencesPort;
  readonly children: React.ReactNode;
}

export function AccessibilityPreferencesProvider({ port, children }: AccessibilityPreferencesProviderProps): React.JSX.Element {
  return <AccessibilityContext.Provider value={port}>{children}</AccessibilityContext.Provider>;
}
