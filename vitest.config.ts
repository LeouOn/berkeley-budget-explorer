import { URL, fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "happy-dom",
    globals: false,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules", "dist", "tests/browser/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
