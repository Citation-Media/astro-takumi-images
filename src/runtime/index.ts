import type { AstroGlobal } from "astro";
import { config } from "virtual:astro-takumi-images/config";

import { prepareImage, renderPrepared } from "./render.js";

export { sizePresets } from "../types.js";
export type {
  ImageComponent,
  ImageConfig,
  ImageEncoding,
  ImageParams,
  ImageSize,
  SizePreset,
  TemplateModule,
} from "../types.js";

/** The parts of the page's `Astro` object that `imageUrl` uses. */
export type ImagePageContext = Pick<AstroGlobal, "cache" | "url">;

/** The cache tag a page gets for each image it links, such as `og-image:blog/hello`. */
export const imageTag = (path: string) => `og-image:${path}`;

/**
 * The current URL of an image, such as `/og/blog/hello.3f9a1c2e7b04.png`, for `og:image` or an
 * `<img>`; `undefined` when no template answers the path. Combine it with `Astro.site` for an
 * absolute URL.
 *
 * Pass the page's `Astro` to tie the page to the image in Astro's route cache: the page gets the
 * tag `og-image:<path>`, so `Astro.cache.invalidate({ tags: [imageTag(path)] })` renders every
 * page with that image again, and a page that sets no cache lifetime gets the integration's
 * `pageCache`. While the page comes from the cache, the template does not run.
 */
export const imageUrl = async (path: string, page?: ImagePageContext) => {
  const image = await prepareImage(path, page?.url);
  if (!image) {
    return;
  }
  if (page?.cache.enabled) {
    page.cache.set({ tags: [imageTag(path)] });
    if (config.pageCache && page.cache.options.maxAge === undefined) {
      page.cache.set(config.pageCache);
    }
  }
  return `${config.route}/${image.file}`;
};

/**
 * Renders the image of a path to bytes outside the route, for example in an endpoint or test.
 * On demand, pass the request's `url` (such as `Astro.url`), which Astro needs to locate the
 * font files.
 */
export const renderImage = async (
  path: string,
  page?: Pick<ImagePageContext, "url">
) => {
  const image = await prepareImage(path, page?.url);
  return image ? renderPrepared(image, page?.url, "auto") : undefined;
};
