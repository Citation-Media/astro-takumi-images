import node from "@astrojs/node";
import { defineConfig, memoryCache } from "astro/config";

import { sharedConfig } from "../shared/config.ts";

export default defineConfig({
  // The tests run on 127.0.0.1, which on demand serves the sources of <Image> and <Picture>.
  image: { domains: ["127.0.0.1"] },
  ...sharedConfig({
    runtime:
      (process.env.TAKUMI_RUNTIME as "auto" | "native" | "wasm" | undefined) ??
      "auto",
  }),
  adapter: node({ mode: "standalone" }),
  // Astro's own in-memory route cache, so the tests cover page caching without a CDN.
  cache: { provider: memoryCache() },
  output: "server",
});
