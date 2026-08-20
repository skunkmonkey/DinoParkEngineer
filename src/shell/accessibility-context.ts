import { createContext } from "react";

import {
  createAccessibilityPreferencesPort,
  type AccessibilityPreferencesPort,
} from "./providers/accessibility.js";

const fallbackPort = createAccessibilityPreferencesPort();
export const AccessibilityContext = createContext<AccessibilityPreferencesPort>(fallbackPort);
