import type { AstroGlobal } from "astro";
import { config } from "virtual:astro-takumi-images/config";

import { formatOf, prepareImage, renderPrepared } from "./render.js";
import type { PreparedImage } from "./render.js";

export { sizePresets } from "../types.js";
export type {
  ImageAnimation,
  ImageComponent,
  ImageConfig,
  ImageEncoding,
  ImageFormat,
  ImageParams,
  ImageSize,
  SizePreset,
  TemplateModule,
} from "../types.js";

/** The parts of the page's `Astro` object that `imageUrl` uses. */
export type ImagePageContext = Pick<AstroGlobal, "cache" | "url">;

/** The cache tag a page gets for each image it links, such as `og-image:blog/hello`. */
export const imageTag = (path: string) => `og-image:${path}`;

/** Tags the page with the image and gives it the default lifetime if it has none. */
const linkPage = (path: string, page: ImagePageContext | undefined) => {
  if (page?.cache.enabled) {
    page.cache.set({ tags: [imageTag(path)] });
    if (config.pageCache && page.cache.options.maxAge === undefined) {
      page.cache.set(config.pageCache);
    }
  }
};

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
  linkPage(path, page);
  return `${config.route}/${image.file}`;
};

/** The source of an image for Astro's `<Image>` and `<Picture>`, spread into their props. */
export interface ImageSourceProps {
  /** Image metadata for prerendered images, or the absolute URL of an image rendered on demand. */
  src:
    | {
        src: string;
        width: number;
        height: number;
        format: "png" | "jpg" | "webp" | "gif";
      }
    | string;
  width: number;
  height: number;
}

const metadataFormat = (image: PreparedImage) => {
  const format = formatOf(image.definition);
  if (format === "jpeg") {
    return "jpg";
  }
  return format === "apng" ? "png" : format;
};

/**
 * The source of an image for Astro's `<Image>` and `<Picture>`, so the project's image service
 * (sharp, Cloudflare Images, or another) resizes it and converts it to AVIF or WebP:
 *
 * ```astro
 * <Picture {...await imageSource("blog/hello", Astro)} formats={["avif", "webp"]} widths={[400, 800]} alt="" />
 * ```
 *
 * A prerendered image is handed over as image metadata, which the build reads from its output.
 * An image rendered on demand is handed over as its absolute URL, which the image service
 * fetches; Astro has to allow the site's host as a remote image domain, which the integration
 * adds for `site`. Keep such templates on their default PNG, which loses nothing before the
 * image service converts it. Like `imageUrl()`, it ties the page to the image in the route cache.
 */
export const imageSource = async (
  path: string,
  page: ImagePageContext
): Promise<ImageSourceProps | undefined> => {
  const image = await prepareImage(path, page.url);
  if (!image) {
    return undefined;
  }
  linkPage(path, page);
  const url = `${config.route}/${image.file}`;
  const { height, width } = image.size;
  return {
    height,
    src: config.prerender
      ? { format: metadataFormat(image), height, src: url, width }
      : new URL(url, page.url).href,
    width,
  };
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
