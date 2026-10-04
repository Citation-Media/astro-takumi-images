import type { ImagesInput } from "takumi-js";

/** Output size in pixels; `devicePixelRatio` scales the CSS layout into it. */
export interface ImageSize {
  width: number;
  height: number;
  devicePixelRatio?: number;
}

/** Common social image sizes. */
export const sizePresets = {
  og: { height: 630, width: 1200 },
  square: { height: 1200, width: 1200 },
  thumbnail: { height: 900, width: 1600 },
} satisfies Record<string, ImageSize>;

export type SizePreset = keyof typeof sizePresets;

/**
 * PNG by default, which is lossless and the best source for Astro's `<Image>` and `<Picture>`;
 * `quality` (0 to 100) applies to JPEG and WebP, and WebP without it is lossless. Animations
 * render as WebP, APNG, or GIF.
 */
export type ImageEncoding =
  | { format?: "png" }
  | { format: "jpeg"; quality?: number }
  | { format: "webp"; quality?: number }
  | { format: "apng" }
  | { format: "gif" };

export type ImageFormat = NonNullable<ImageEncoding["format"]>;

/** Plays the template's CSS animations into an animated WebP, APNG, or GIF. */
export interface ImageAnimation {
  /** Length in milliseconds. */
  duration: number;
  /** Frames per second; defaults to 30. */
  fps?: number;
}

/** How a template is drawn: the `image` export of a template file. */
export type ImageConfig = ImageEncoding & {
  /** A preset or a size in pixels; defaults to `og`, 1200 × 630. */
  size?: SizePreset | ImageSize;
  /** Further CSS for this template, such as `import css from "./card.css?inline"`. */
  css?: string;
  /** Takumi's image options, such as pre-fetched `sources` for local files and fetch limits. */
  images?: ImagesInput;
  /** Changes the URL for inputs the checksum cannot see, such as the bytes behind an image `src`. */
  version?: string;
  /** Render an animation instead of one frame; `format` is then `webp` (default), `apng`, or `gif`. */
  animation?: ImageAnimation;
};

/**
 * A template component: an Astro component, or a React function component that may be async.
 * It fills the canvas, so its root should take the full width and height.
 */
// oxlint-disable-next-line typescript/no-explicit-any -- React and Astro components take any props.
export type ImageComponent = (...args: any[]) => unknown;

/** Route parameters of a template, such as `{ slug: "hello" }` for `blog/[slug].astro`. */
export type ImageParams = Record<string, string>;

/** What a template file exports. */
export interface TemplateModule {
  default: ImageComponent;
  image?: ImageConfig;
  /** The parameter sets to prerender, as for Astro pages; only dynamic templates need it. */
  getStaticPaths?: () =>
    | { params: ImageParams }[]
    | Promise<{ params: ImageParams }[]>;
}

/** Cache options that `imageUrl(path, Astro)` gives a page that sets none itself. */
export interface PageCacheOptions {
  maxAge?: number;
  swr?: number;
}

/** Options the integration passes to the runtime. */
export interface RuntimeConfig {
  route: string;
  /** Whether the route is prerendered, which decides what `imageSource()` hands to `<Image>`. */
  prerender: boolean;
  /** Root-relative folder of the templates, such as `/src/og/`. */
  templates: string;
  /** Versions of this package and Takumi, part of every checksum, so an update renews the URLs. */
  renderer: string;
  cacheMaxAge: number;
  pageCache: PageCacheOptions | false;
  fonts: boolean;
  tailwind: boolean;
}
