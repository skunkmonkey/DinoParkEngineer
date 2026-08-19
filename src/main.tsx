import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AppShell } from "./app-shell.js";
import "./styles/global.css";

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("SHELL_ROOT_MISSING: the document does not contain #root.");
}

createRoot(rootElement).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
);
