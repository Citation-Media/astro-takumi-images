import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import type { AstroUserConfig } from "astro";
import takumiImages from "astro-takumi-images";
import type { TakumiImagesOptions } from "astro-takumi-images";
import { fontProviders } from "astro/config";

/** The setup every fixture shares; each one adds its output mode and adapter. */
export const sharedConfig = (
  options: Partial<TakumiImagesOptions> = {}
): AstroUserConfig => ({
  fonts: [
    {
      cssVariable: "--font-inter",
      name: "Inter",
      provider: fontProviders.google(),
      weights: [400, 600],
    },
    {
      cssVariable: "--font-jetbrains-mono",
      name: "JetBrains Mono",
      provider: fontProviders.google(),
      weights: [400],
    },
  ],
  integrations: [
    react(),
    takumiImages({
      images: "../shared/src/og-images.ts",
      stylesheets: ["../shared/src/global.css"],
      ...options,
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
