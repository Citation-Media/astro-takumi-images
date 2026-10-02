# astro-takumi-images

Open Graph images, social cards, and thumbnails for [Astro](https://astro.build), drawn by [Takumi](https://takumi.kane.tw) from your own React or Astro components. No headless browser, no fixed layouts: you bring the components, the integration renders them, for static sites and for on-demand rendering alike.

- **One rule for caching.** Every image lives at `/og/<key>.<checksum>.<ext>`. The checksum covers everything the image is made of, so a URL never changes its content and is cached forever by browsers, CDNs, and the Workers cache. A changed post, template, theme, or font gets a new URL by itself; nothing is purged.
- **SSG and SSR.** Static sites prerender the images during the build. Server output renders each image on its first request and lets the cache keep it.
- **Every runtime.** Node.js and Bun use Takumi's native addon; Cloudflare Workers (workerd), Deno, and other edge runtimes use WebAssembly. You can force either.
- **Your design system.** Tailwind CSS v4 and other stylesheets compile through Vite and apply by class, and the families of Astro's Fonts API render with the same files as your pages.

## Install

```bash
npx astro add astro-takumi-images
```

React templates also need `react` and `react-dom` (`npx astro add react`); Astro templates need nothing else. Astro 6 or later.

## Set Up

Register the integration and point it at a module that describes your images:

```ts title="astro.config.ts"
import { defineConfig } from "astro/config";
import takumiImages from "astro-takumi-images";

export default defineConfig({
  site: "https://example.com",
  integrations: [
    takumiImages({
      images: "./src/og-images.ts",
      stylesheets: ["./src/styles/global.css"],
    }),
  ],
});
```

Describe the images by key. A key may contain slashes; each image names its component, the props, and optionally a size and format:

```ts title="src/og-images.ts"
import { getCollection } from "astro:content";
import { defineImages } from "astro-takumi-images/runtime";

import PostImage from "./components/post-image.astro";

export default defineImages(async () =>
  Object.fromEntries(
    (await getCollection("blog")).flatMap((post) => [
      [
        `blog/${post.id}`,
        { component: PostImage, props: { title: post.data.title } },
      ],
      [
        `blog/${post.id}/thumbnail`,
        {
          component: PostImage,
          props: { title: post.data.title },
          size: "thumbnail",
          format: "webp",
          quality: 90,
        },
      ],
    ])
  )
);
```

The component fills the canvas; give its root the full size:

```astro title="src/components/post-image.astro"
---
const { title } = Astro.props;
---

<div class="flex h-full w-full items-end bg-slate-950 p-20 font-sans text-white">
  <h1 class="text-7xl font-semibold">{title}</h1>
</div>
```

Put the current URL into the page:

```astro title="src/layouts/post.astro"
---
import { imageUrl } from "astro-takumi-images/runtime";

const image = await imageUrl(`blog/${Astro.props.post.id}`);
---

{image && <meta property="og:image" content={new URL(image, Astro.site)} />}
```

## How It Works

1. `imageUrl(key)` renders the component to HTML, as Astro renders it on the server, and hashes that HTML together with the CSS, the font files, the size, the format, and the versions of this package and Takumi.
2. The route `/og/[...image]` answers for that URL. Prerendered, the build writes the file. On demand, the first request renders it with Takumi and answers with `Cache-Control: public, max-age=31536000, immutable`, and Astro's route cache keeps it where the adapter provides one, such as `cacheCloudflare()`.
3. When anything that makes up the image changes, the checksum and so the URL change. Pages point to the new URL, it renders once, and old URLs fall out of the caches unused. A request for an outdated checksum redirects (307) to the current file; an unknown key answers 404. A failed render answers 500 with `no-store`, so no broken image is cached.

Prerendered images are static files, which lose the route's headers. For hosts that read a `_headers` file, such as Cloudflare and Netlify, the integration adds the immutable rule after the build; turn that off with `headersFile: false`.

## Runtimes

| Runtime | Backend with `runtime: "auto"` | Tested |
| --- | --- | --- |
| Node.js (`@astrojs/node`, prerendering) | Native addon | ✓ |
| Bun | Native addon | ✓ |
| Cloudflare Workers (`@astrojs/cloudflare`, workerd) | WebAssembly | ✓ |
| Deno | WebAssembly | ✓ |
| Vercel and Netlify edge functions | WebAssembly | – |

`auto` follows the export conditions of the runtime. Set `runtime: "wasm"` where the native addon is missing for the host's CPU or libc, and `runtime: "native"` where a bundler drops the `node` condition. Rendering on demand takes CPU time: on Cloudflare, it does not fit the 10 ms of the Workers free plan.

## Fonts

With `fonts: true` (the default), every family of Astro's [Fonts API](https://docs.astro.build/en/guides/fonts/) is registered with Takumi under its CSS variable, and the variable points to it. Font stacks such as `font-family: var(--font-inter), sans-serif` therefore resolve to the same files in the image as on the page: no second font setup, no request to a font service at render time. Variable fonts keep their axes. Only the configured subsets exist; other characters fall back to Takumi's built-in Geist.

On demand, the route downloads each font file once per process or isolate from the site itself.

## CSS

Stylesheets in `stylesheets` and `styleGlobs` compile through Vite (`?inline`), so Tailwind, PostCSS, and CSS modules work as on the page; classes apply by name. Takumi has its own CSS engine, so with `tailwind: true` (the default) the CSS is adapted for each canvas:

- `clamp()`, `min()`, and `max()` of plain lengths resolve to pixels.
- Container queries and container units follow the canvas, as they follow the viewport without a container.
- The `dark:` variant's `:is(.dark *)` becomes a `.dark` descendant selector.
- `content` drops its alternative text (`"/" / ""`).
- The `initial-value` of registered properties applies, which Tailwind's gradients, shadows, and transforms need.

Astro components render without their scoped `<style>`; style templates with classes, inline styles, or `<style is:inline>`. Animations do not play: an image is one frame.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `images` | required | Module whose default export is the images: a map, or a function that returns one. Relative to the project root. |
| `route` | `"/og"` | Path the images are served under. |
| `prerender` | `true` for `output: "static"`, otherwise `false` | Render during the build instead of on demand. |
| `runtime` | `"auto"` | `"native"` or `"wasm"` to force Takumi's backend. |
| `fonts` | `true` | Register the families of Astro's Fonts API. |
| `stylesheets` | `[]` | Stylesheets compiled by Vite, such as `./src/styles/global.css`. |
| `styleGlobs` | `[]` | Globs of further stylesheets, such as `/src/components/**/*.module.css`. |
| `tailwind` | `true` | Adapt the CSS to Takumi's engine. |
| `cacheMaxAge` | `31536000` | Cache lifetime in seconds. |
| `cacheTags` | `[]` | Extra tags for Astro's route cache, besides `takumi-images`. |
| `headersFile` | `true` | Add the immutable rule for prerendered images to `_headers`. |

## Image Definitions

| Field | Description |
| --- | --- |
| `component` | React function component or Astro component. |
| `props` | Props for the component. |
| `size` | `"og"` (1200 × 630, default), `"square"` (1200 × 1200), `"thumbnail"` (1600 × 900), or `{ width, height, devicePixelRatio? }`; `devicePixelRatio` lays out at the size divided by it. |
| `format`, `quality` | `"png"` (default), `"jpeg"`, or `"webp"`; `quality` 0 to 100 for JPEG and WebP. |
| `css` | Further CSS for this image. |
| `images` | Takumi's image options, such as pre-fetched `sources` for local files: `images: [{ src: "logo", data }]` with `<img src="logo">`. Remote `src` URLs load without it. |
| `version` | Changes the checksum for inputs it cannot see, such as the bytes behind an image `src`. |

## API

From `astro-takumi-images/runtime`:

- `defineImages(source)` types the images module.
- `imageUrl(key)` returns the current path of an image, or `undefined` for an unknown key.
- `renderImage(definition, requestUrl?)` renders a definition to bytes, for scripts and tests.

From `astro-takumi-images`: the integration as default export, `toTakumiCss(css, canvas)`, and `sizePresets`.

## Development

```bash
npm install
npm test          # unit tests
npm run test:e2e  # builds the fixtures and checks every runtime; Bun and Deno when installed
npm run check     # types, Oxlint, Oxfmt
```

The fixtures in [fixtures](fixtures) share their templates and render a React and an Astro template: `static` prerenders, `node` renders on demand with `TAKUMI_RUNTIME` choosing the backend, and `cloudflare` runs in workerd through `astro preview`.

## License

[MIT](LICENSE) © Citation Media
