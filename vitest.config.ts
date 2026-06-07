import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "dist/**"],
    testTimeout: 30000,
  },
});
