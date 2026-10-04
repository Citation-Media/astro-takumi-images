# Changelog

## 0.1.0

First release.

- Image templates as files in `src/og`, routed like pages (`blog/[slug].astro`, rest parameters, `_` files skipped), as Astro or async React components that fetch their own data, with an `image` export for size, format, and CSS, and `getStaticPaths` for static output.
- Images under `<route>/<path>.<checksum>.<ext>`: the checksum covers HTML, CSS, fonts, size, format, and renderer versions, so every URL is cached immutably and a changed image gets a new URL.
- Prerendered for static output, on demand for server output, with redirects from outdated checksums and uncached failures.
- `imageUrl(path, Astro)` ties pages to their images in Astro's route cache: an `og-image:<path>` tag per image and a default page lifetime of 30 minutes with a day of stale-while-revalidate; `imageTag()` for `cache.invalidate()`.
- `imageSource(path, Astro)` hands images to Astro's `<Image>` and `<Picture>` as a lossless source: image metadata when prerendered, the absolute URL on demand, so sharp, Cloudflare Images, or another image service resizes and converts them.
- Animations: `image.animation` plays a template's CSS animations into an animated WebP, APNG, or GIF.
- Takumi's native addon on Node.js and Bun, WebAssembly on workerd, Deno, and edge runtimes; `runtime` forces either.
- Fonts from Astro's Fonts API, stylesheets compiled by Vite, and `toTakumiCss()` for Tailwind CSS v4.
