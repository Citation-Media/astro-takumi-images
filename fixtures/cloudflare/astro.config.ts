import cloudflare from "@astrojs/cloudflare";
import { defineConfig } from "astro/config";

import { sharedConfig } from "../shared/config.ts";

export default defineConfig({
  // The tests run on 127.0.0.1, which on demand serves the sources of <Image> and <Picture>.
  image: { domains: ["127.0.0.1"] },
  ...sharedConfig(),
  adapter: cloudflare(),
  output: "server",
});
