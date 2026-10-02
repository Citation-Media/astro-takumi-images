import cloudflare from "@astrojs/cloudflare";
import { defineConfig } from "astro/config";

import { sharedConfig } from "../shared/config.ts";

export default defineConfig({
  ...sharedConfig(),
  adapter: cloudflare(),
  output: "server",
});
