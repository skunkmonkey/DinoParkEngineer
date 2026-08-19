import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

/**
 * Normalize a static-host base path into the form Vite and the browser expect.
 * A path (rather than a URL) keeps generated assets portable between local
 * hosting and a conventional subdirectory deployment.
 */
export const normalizeBasePath = (value: string | undefined): string => {
  const trimmed = value?.trim() ?? "";

  if (trimmed === "") {
    return "/";
  }

  if (trimmed.includes("?") || trimmed.includes("#")) {
    throw new Error("BASE_PATH must not contain a query string or fragment");
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;

  return withLeadingSlash.endsWith("/")
    ? withLeadingSlash
    : `${withLeadingSlash}/`;
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = normalizeBasePath(env.BASE_PATH || env.VITE_BASE_PATH);

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: "prompt",
        injectRegister: false,
        manifest: {
          name: "Dino Park Engineer",
          short_name: "Dino Park",
          description: "Engineer a deterministic automated dinosaur park.",
          theme_color: "#07131f",
          background_color: "#07131f",
          display: "standalone",
          start_url: base,
        },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: false,
          skipWaiting: false,
          navigateFallback: `${base}index.html`,
          globPatterns: ["**/*.{html,js,css,svg,png,webp,woff2,json}"],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
    },
    preview: {
      host: "127.0.0.1",
      port: 4173,
      strictPort: true,
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: true,
      rollupOptions: {
        output: {
          assetFileNames: "assets/[name]-[hash][extname]",
          chunkFileNames: "assets/[name]-[hash].js",
          entryFileNames: "assets/[name]-[hash].js",
        },
      },
    },
  };
});
