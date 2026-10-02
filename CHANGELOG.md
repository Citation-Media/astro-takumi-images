# Changelog

## 0.1.0

First release.

- Astro integration that serves images rendered by Takumi from React and Astro components under `<route>/<key>.<checksum>.<ext>`, cached immutably and renewed by a new URL whenever their content changes.
- Prerendered for static output, on demand for server output, with redirects from outdated checksums and uncached failures.
- Takumi's native addon on Node.js and Bun, WebAssembly on workerd, Deno, and edge runtimes; `runtime` forces either.
- Fonts from Astro's Fonts API, stylesheets compiled by Vite, and `toTakumiCss()` for Tailwind CSS v4.
