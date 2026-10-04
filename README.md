# astro-takumi-images

Open Graph images, social cards, and thumbnails for [Astro](https://astro.build), drawn by [Takumi](https://takumi.kane.tw) from your own Astro or React templates. No headless browser and no fixed layouts: a template is a file in `src/og`, routed like a page, and it renders for static sites and on demand alike.

- **Templates as files.** `src/og/blog/[slug].astro` answers `/og/blog/hello.<checksum>.png`. A template reads its parameters and fetches its own data, like a page.
- **One rule for caching.** The checksum in every image URL covers everything the image is made of, so a URL never changes its content and is cached forever. A changed post, template, theme, or font gets a new URL by itself.
- **Astro's route cache.** Pages that link an image are cached with Astro's own cache API and tagged per image; nothing is tied to a hosting provider.
- **Every runtime.** Node.js and Bun use Takumi's native addon; Cloudflare Workers (workerd), Deno, and other edge runtimes use WebAssembly.
- **Your design system.** Tailwind CSS v4 and other stylesheets compile through Vite, and the families of Astro's Fonts API render with the same files as your pages.

## Install

```bash
npx astro add astro-takumi-images
```

React templates also need `react` and `react-dom` (`npx astro add react`). Astro 6 or later.

## Quick Start

1. Register the integration and the stylesheet your templates use:

   ```ts title="astro.config.ts"
   import { defineConfig } from "astro/config";
   import takumiImages from "astro-takumi-images";

   export default defineConfig({
     site: "https://example.com",
     integrations: [takumiImages({ stylesheets: ["./src/styles/global.css"] })],
   });
   ```

2. Add a template. It fills the canvas, so its root takes the full size:

   ```astro title="src/og/blog/[slug].astro"
   ---
   import { getCollection, getEntry } from "astro:content";

   export const image = { size: "og", format: "png" };

   // Only for static output: the parameters to prerender, as for pages.
   export const getStaticPaths = async () =>
     (await getCollection("blog")).map((post) => ({ params: { slug: post.id } }));

   const post = await getEntry("blog", Astro.params.slug);
   ---

   <div class="flex h-full w-full items-end bg-slate-950 p-20 font-sans text-white">
     <h1 class="text-7xl font-semibold">{post?.data.title}</h1>
   </div>
   ```

3. Link it from the page, in the page's own frontmatter:

   ```astro title="src/pages/blog/[slug].astro"
   ---
   import { imageUrl } from "astro-takumi-images/runtime";

   import Layout from "../../layouts/post.astro";

   const ogImage = await imageUrl(`blog/${Astro.params.slug}`, Astro);
   ---

   <Layout ogImage={ogImage && new URL(ogImage, Astro.site).href}>…</Layout>
   ```

## Templates

Every `.astro`, `.tsx`, and `.jsx` file in `src/og` (the `templates` option) is a template, routed like a page:

| File | Image path | URL |
| --- | --- | --- |
| `src/og/home.astro` | `home` | `/og/home.3f9a1c2e7b04.png` |
| `src/og/blog/[slug].astro` | `blog/hello` | `/og/blog/hello.8e0d6b2a91c3.png` |
| `src/og/blog/[slug].thumbnail.tsx` | `blog/hello.thumbnail` | `/og/blog/hello.thumbnail.5b7c0e4f2a18.webp` |
| `src/og/docs/[...path].astro` | `docs/guide/setup` | `/og/docs/guide/setup.c41f9d0e7a26.png` |

Files and folders starting with `_` are not templates, so helpers can sit next to them. Static paths win over parameters, and single parameters over rest parameters.

A template may export:

- `image`: how it is drawn, as `{ size, format, quality, css, images, version }` (see [Image Options](#image-options)).
- `getStaticPaths`: the parameters to prerender for static output, as `[{ params: { slug: "hello" } }]`. On demand, a template answers any parameter.

Astro templates read `Astro.params` and may `await` data in their frontmatter. React templates receive `params` as a prop and may be async:

```tsx title="src/og/blog/[slug].thumbnail.tsx"
export const image = { size: "thumbnail", format: "webp", quality: 90 };

export default async function Thumbnail({
  params,
}: {
  params: { slug: string };
}) {
  const post = await fetch(`https://api.example.com/posts/${params.slug}`).then(
    (response) => response.json()
  );
  return (
    <div className="flex h-full w-full items-center justify-center bg-indigo-600 text-8xl text-white">
      {post.title}
    </div>
  );
}
```

## Caching

### The rule

An image URL carries a checksum of the rendered HTML, the CSS, the font files, the size, the format, and the versions of this package and Takumi. Its content never changes, so the image is served with `Cache-Control: public, max-age=31536000, immutable` and never has to be invalidated. What has to stay fresh is the **page**, because the page decides which URL it links. So:

- **Images** are cached forever, by browsers, CDNs, and Astro's route cache.
- **Pages** are cached by Astro's route cache, tagged with every image they link. When a page renders again, `imageUrl()` runs the template, and a changed image gets a new URL.

### Static output

Pages and images render once per build; there is nothing to configure. Prerendered images are static files, which lose the route's headers, so after the build the integration adds `/og/* Cache-Control: public, max-age=31536000, immutable` to `_headers` for hosts that read it, such as Cloudflare and Netlify (`headersFile: false` turns this off).

### On demand

1. **Configure a cache provider** for Astro's [route caching](https://docs.astro.build/en/guides/caching/), whichever fits your host. The integration only uses Astro's cache API (`Astro.cache`), never a provider directly:

   ```ts title="astro.config.ts"
   import cloudflare from "@astrojs/cloudflare";
   import { cacheCloudflare } from "@astrojs/cloudflare/cache";

   export default defineConfig({
     adapter: cloudflare(),
     cache: { provider: cacheCloudflare() },
     // On Node.js, Astro's own in-memory cache: cache: { provider: memoryCache() } from "astro/config".
   });
   ```

2. **Call `imageUrl(path, Astro)` in the page's frontmatter**, not in a layout or component. Astro streams pages, so only the page's frontmatter can still set its cache options. The page then gets:
   - the tag `og-image:<path>` for each image it links,
   - and, if it sets no lifetime itself, `pageCache`: by default **30 minutes** fresh (`maxAge: 1800`), then up to a day in which the cache serves the page while it renders again in the background (`swr: 86400`).

   While the page comes from the cache, neither the page nor its templates run, and no data is fetched for them.

3. **Choose how fresh images have to be.**
   - **Lifetime only:** keep the default or set your own, per page with `Astro.cache.set({ maxAge, swr })`, per route in the config, or for all image pages with `pageCache`. An image changes at the latest when its page renders again.
   - **On change:** invalidate the image's tag when its data changes, for example from a webhook of your CMS or API. Every page linking that image renders again and links the new URL:

     ```ts title="src/pages/api/revalidate.ts"
     import type { APIContext } from "astro";
     import { imageTag } from "astro-takumi-images/runtime";

     export const prerender = false;

     export const POST = async ({ cache, request }: APIContext) => {
       if (
         request.headers.get("authorization") !==
         `Bearer ${import.meta.env.REVALIDATE_TOKEN}`
       ) {
         return new Response(null, { status: 401 });
       }
       const { path } = await request.json(); // such as "blog/hello"
       await cache.invalidate({ tags: [imageTag(path)] });
       return new Response(null, { status: 204 });
     };
     ```

     How the webhook is called and secured is up to you; it only has to reach `cache.invalidate()`.

4. **The image route** renders each URL on its first request and keeps it with `cache.set({ maxAge: 31536000, tags: ["og-image:<path>"] })`. An outdated checksum redirects (307) to the current file, an unknown path answers 404, and a failed render answers 500 with `no-store`, so no broken image is cached.

Set cache hints on the page, not in a template: templates render in Astro's container, where `Astro.cache` is not available, so a template's `Astro.cache.set()` has no effect. Data a template fetches stays as fresh as the page that links it.

Without a cache provider, nothing is cached: every page render runs its templates, which stays correct and costs the time measured below.

## Performance

Takumi is fast enough that rendering is rarely the cost; data a template fetches is. Medians of 20 renders with Astro templates, Tailwind, and two Inter faces on an Apple M-series machine (`npm run bench`, local workerd through `astro preview`):

| Runtime | `imageUrl()` (template to HTML and checksum) | OG image, PNG 1200 × 630 | Thumbnail, WebP 1600 × 900 | First render (fonts, backend) |
| --- | --- | --- | --- | --- |
| Node.js, native | 0.5 ms | 6.5 ms | 37 ms | 38 ms |
| Bun, native | 0.5 ms | 6.5 ms | 37 ms | 26 ms |
| Node.js, WebAssembly | 0.5 ms | 11 ms | 19 ms | 122 ms |
| Deno, WebAssembly | 0.6 ms | 14 ms | 23 ms | 129 ms |
| Cloudflare workerd, WebAssembly | 1 ms | 14 ms | 22 ms | 110 ms |

Cloud machines are slower than a laptop, so expect a multiple of these figures in production. On Cloudflare, a render needs more than the 10 ms of CPU the Workers free plan allows per request.

## Runtimes

| Runtime | Backend with `runtime: "auto"` | Tested |
| --- | --- | --- |
| Node.js (`@astrojs/node`, prerendering) | Native addon | ✓ |
| Bun | Native addon | ✓ |
| Cloudflare Workers (`@astrojs/cloudflare`, workerd) | WebAssembly | ✓ |
| Deno | WebAssembly | ✓ |
| Vercel and Netlify edge functions | WebAssembly | – |

`auto` follows the export conditions of the runtime. Set `runtime: "wasm"` where the native addon is missing for the host's CPU or libc, and `runtime: "native"` where a bundler drops the `node` condition.

## Fonts

With `fonts: true` (the default), every family of Astro's [Fonts API](https://docs.astro.build/en/guides/fonts/) is registered with Takumi under its CSS variable, and the variable points to it. Font stacks such as `font-family: var(--font-inter), sans-serif` therefore resolve to the same files in the image as on the page: no second font setup and no request to a font service at render time. Variable fonts keep their axes. Only the configured subsets exist; other characters fall back to Takumi's built-in Geist. Fonts loaded through `@font-face` in your CSS do not reach Takumi.

## CSS

Takumi applies CSS by class. A template gets:

- the `stylesheets` and `styleGlobs` of the integration, compiled through Vite, so Tailwind and PostCSS work as on your pages;
- its own `image.css`, for example `import css from "./card.css?inline"`;
- inline styles and `<style is:inline>`.

A template's scoped `<style>` and CSS it imports for its side effects are bundled by Astro for pages and do not reach the image. Rules on `html` and `body` do not apply, since an image has no body: style the template's root. `prefers-color-scheme` never matches; set the `dark` class in the template.

Takumi has its own CSS engine, so with `tailwind: true` (the default) the CSS is adapted for each canvas: `clamp()`, `min()`, and `max()` of plain lengths resolve to pixels, container queries and units follow the canvas, the `dark:` variant's `:is(.dark *)` becomes a `.dark` selector, `content` drops its alternative text, and the `initial-value` of registered properties applies, which Tailwind's gradients, shadows, and transforms need.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `templates` | `"./src/og"` | Folder of the templates, relative to the project root. |
| `route` | `"/og"` | Path the images are served under. |
| `prerender` | `true` for `output: "static"`, otherwise `false` | Render during the build instead of on demand. |
| `runtime` | `"auto"` | `"native"` or `"wasm"` to force Takumi's backend. |
| `pageCache` | `{ maxAge: 1800, swr: 86400 }` | Route cache for pages that call `imageUrl(path, Astro)` and set no lifetime; `false` leaves pages alone. |
| `cacheMaxAge` | `31536000` | Cache lifetime of image files in seconds. |
| `fonts` | `true` | Register the families of Astro's Fonts API. |
| `stylesheets` | `[]` | Stylesheets compiled by Vite, such as `./src/styles/global.css`. |
| `styleGlobs` | `[]` | Globs of further stylesheets, such as `/src/components/**/*.module.css`. |
| `tailwind` | `true` | Adapt the CSS to Takumi's engine. |
| `headersFile` | `true` | Add the immutable rule for prerendered images to `_headers`. |

## Image Options

The `image` export of a template:

| Field | Description |
| --- | --- |
| `size` | `"og"` (1200 × 630, default), `"square"` (1200 × 1200), `"thumbnail"` (1600 × 900), or `{ width, height, devicePixelRatio? }`; `devicePixelRatio` lays out at the size divided by it. |
| `format`, `quality` | `"png"` (default), `"jpeg"`, or `"webp"`; `quality` 0 to 100 for JPEG and WebP. |
| `css` | Further CSS for this template. |
| `images` | Takumi's image options, such as pre-fetched `sources` for local files: `images: [{ src: "logo", data }]` with `<img src="logo">`. Remote `src` URLs load without it. |
| `version` | Changes the checksum for inputs it cannot see, such as the bytes behind an image `src`. |

## API

From `astro-takumi-images/runtime`:

- `imageUrl(path, Astro?)` returns the current path of an image, such as `/og/blog/hello.8e0d6b2a91c3.png`, or `undefined` when no template answers it. With `Astro`, it tags and caches the page as described in [Caching](#caching).
- `imageTag(path)` returns the cache tag of an image's pages, for `cache.invalidate()`.
- `renderImage(path, { url }?)` renders an image to bytes, for endpoints and tests; on demand, pass the request URL so Astro can locate the font files.

From `astro-takumi-images`: the integration as default export, `toTakumiCss(css, canvas)`, and `sizePresets`.

## Development

```bash
npm install
npm test          # unit tests
npm run test:e2e  # builds the fixtures and checks every runtime; Bun and Deno when installed
npm run bench     # render times of the Node.js fixture, native and WebAssembly
npm run check     # types, Oxlint, Oxfmt
```

The fixtures in [fixtures](fixtures) share their templates in `fixtures/shared/og`: `static` prerenders, `node` renders on demand with Astro's in-memory route cache and `TAKUMI_RUNTIME` choosing the backend, and `cloudflare` runs in workerd through `astro preview`.

## License

[MIT](LICENSE) © Citation Media
