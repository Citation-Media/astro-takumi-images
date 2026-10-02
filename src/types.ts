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

/** PNG by default; `quality` (0 to 100) applies to JPEG and WebP, and WebP without it is lossless. */
export type ImageEncoding =
  | { format?: "png" }
  | { format: "jpeg"; quality?: number }
  | { format: "webp"; quality?: number };

/**
 * A component that fills the canvas: a React function component or an Astro component. Its
 * root should take the full width and height, such as `w-full h-full` or `display: flex`.
 */
// oxlint-disable-next-line typescript/no-explicit-any -- React and Astro components take any props.
export type ImageComponent = (...args: any[]) => unknown;

/** One image: the component that draws it, its props, and how it is encoded. */
export type ImageDefinition = ImageEncoding & {
  component: ImageComponent;
  props?: Record<string, unknown>;
  /** A preset or a size in pixels; defaults to `og`, 1200 × 630. */
  size?: SizePreset | ImageSize;
  /** Further CSS for this image, on top of the integration's `stylesheets`. */
  css?: string;
  /** Takumi's image options, such as pre-fetched `sources` for local files and fetch limits. */
  images?: ImagesInput;
  /** Changes the URL for inputs the checksum cannot see, such as the bytes behind an image `src`. */
  version?: string;
};

/** Images by key; a key may contain slashes, such as `blog/hello-world`. */
export type ImageMap = Record<string, ImageDefinition>;

/** The default export of the images module: a map, or a function that builds one per request. */
export type ImageSource = ImageMap | (() => ImageMap | Promise<ImageMap>);

/** Options the integration passes to the route at runtime. */
export interface RuntimeConfig {
  route: string;
  /** Versions of this package and Takumi, part of every checksum, so an update renews the URLs. */
  renderer: string;
  cacheMaxAge: number;
  cacheTags: string[];
  fonts: boolean;
  tailwind: boolean;
}
