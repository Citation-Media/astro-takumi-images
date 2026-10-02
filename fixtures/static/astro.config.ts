import { defineConfig } from "astro/config";

import { sharedConfig } from "../shared/config.ts";

export default defineConfig({ ...sharedConfig(), output: "static" });
