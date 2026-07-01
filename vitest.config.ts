import { defineConfig } from "vitest/config";

// Vitest config — matches the project's ESM ("type": "module") + bundler
// moduleResolution. Test files live next to the modules they cover.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    globals: false,
  },
});
