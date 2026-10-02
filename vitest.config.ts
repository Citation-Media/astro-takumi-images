import { defineConfig } from "vitest/config";

// End-to-end tests build fixtures and start servers on fixed ports, so they run one at a time.
export default defineConfig({
  test: { fileParallelism: false },
});
