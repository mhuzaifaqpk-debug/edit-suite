// @lovable.dev/vite-tanstack-config provides the standard TanStack Start setup.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // Electron needs a real Node-compatible production server because TanStack
  // Start renders the HTML through SSR; it does not emit a standalone index.html.
  nitro: {
    preset: "node-server",
  },
});
