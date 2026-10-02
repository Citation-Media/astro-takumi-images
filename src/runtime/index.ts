import { config } from "virtual:astro-takumi-images/config";

import type { ImageDefinition, ImageSource } from "../types.js";
import { loadImages, prepareImage, renderPrepared } from "./render.js";

export { sizePresets } from "../types.js";
export type {
  ImageComponent,
  ImageDefinition,
  ImageEncoding,
  ImageMap,
  ImageSize,
  ImageSource,
  SizePreset,
} from "../types.js";

/** Types the default export of the images module. */
export const defineImages = <TSource extends ImageSource>(source: TSource) =>
  source;

/**
 * The current URL of an image, such as `/og/blog/hello.3f9a1c2e7b04.png`, for `og:image` or an
 * `<img>`; `undefined` when the images module has no such key. Combine it with `Astro.site` for
 * an absolute URL.
 */
export const imageUrl = async (key: string) => {
  const images = await loadImages();
  const definition = images[key];
  if (!definition) {
    return;
  }
  const { file } = await prepareImage(key, definition);
  return `${config.route}/${file}`;
};

/** Renders an image definition to bytes, outside the route, for example in a script or test. */
export const renderImage = async (
  definition: ImageDefinition,
  requestUrl?: URL
) =>
  renderPrepared(await prepareImage("image", definition), requestUrl, "auto");
