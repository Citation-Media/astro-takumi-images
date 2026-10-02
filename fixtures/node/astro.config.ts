import node from "@astrojs/node";
import { defineConfig } from "astro/config";

import { sharedConfig } from "../shared/config.ts";

export default defineConfig({
  ...sharedConfig({
    runtime:
      (process.env.TAKUMI_RUNTIME as "auto" | "native" | "wasm" | undefined) ??
      "auto",
  }),
  adapter: node({ mode: "standalone" }),
  output: "server",
});
