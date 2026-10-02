// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Public (non-secret) backend config fallback.
// These values are publishable by design (they ship in every client bundle),
// so baking them here guarantees the published build always has them even if
// VITE_* env vars are unavailable at build time. Runtime values from the
// environment still take precedence via Vite's normal env resolution.
const PUBLIC_SUPABASE_CONFIG: Record<string, string> = {
  VITE_SUPABASE_URL: "https://kpapxeicbdnbmjylulcc.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_UYSlqobl2twiTWWn8nzKoQ_uS0AXXzY",
  VITE_SUPABASE_PROJECT_ID: "kpapxeicbdnbmjylulcc",
};

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: Object.fromEntries(
      Object.entries(PUBLIC_SUPABASE_CONFIG).map(([key, value]) => [
        `import.meta.env.${key}`,
        JSON.stringify(value),
      ]),
    ),
  },
});
