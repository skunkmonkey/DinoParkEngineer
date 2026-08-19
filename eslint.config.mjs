import eslint from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const browserGlobals = {
  AbortController: "readonly",
  Blob: "readonly",
  CSS: "readonly",
  CustomEvent: "readonly",
  DOMException: "readonly",
  Event: "readonly",
  EventTarget: "readonly",
  FormData: "readonly",
  Headers: "readonly",
  HTMLElement: "readonly",
  HTMLInputElement: "readonly",
  IntersectionObserver: "readonly",
  KeyboardEvent: "readonly",
  Map: "readonly",
  MessageChannel: "readonly",
  MutationObserver: "readonly",
  Node: "readonly",
  Promise: "readonly",
  ReadableStream: "readonly",
  Request: "readonly",
  Response: "readonly",
  Set: "readonly",
  Storage: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  WebSocket: "readonly",
  Window: "readonly",
  Worker: "readonly",
  document: "readonly",
  globalThis: "readonly",
  navigator: "readonly",
  performance: "readonly",
  queueMicrotask: "readonly",
  requestAnimationFrame: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  window: "readonly",
};

const nodeGlobals = {
  ...browserGlobals,
  Buffer: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  console: "readonly",
  process: "readonly",
};

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "*.d.ts",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: nodeGlobals,
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: browserGlobals,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      "no-undef": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": [
        "warn",
        {
          allowConstantExport: true,
        },
      ],
    },
  },
  {
    files: ["scripts/**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: nodeGlobals,
    },
    rules: {
      "no-console": "off",
    },
  },
);
