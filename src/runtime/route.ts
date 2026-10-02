import type { APIContext } from "astro";
import { config } from "virtual:astro-takumi-images/config";

import {
  contentTypeOf,
  loadImages,
  prepareImage,
  renderPrepared,
} from "./render.js";

const file = /^(?<key>.+)\.(?<hash>[\da-f]{12})\.(?<extension>png|jpg|webp)$/u;

const empty = (status: number, headers: Record<string, string> = {}) =>
  new Response(null, {
    headers: { "Cache-Control": "no-store", ...headers },
    status,
  });

/** Every current image file, for the build to prerender. */
export const getStaticPaths = async () => {
  const images = await loadImages();
  return Promise.all(
    Object.entries(images).map(async ([key, definition]) => {
      const image = await prepareImage(key, definition);
      return { params: { image: image.file } };
    })
  );
};

/**
 * Serves `<route>/<key>.<checksum>.<extension>`. The current file renders and is cached forever,
 * since its URL changes with its content; a former checksum redirects to the current file, and a
 * failed render is never cached.
 */
export const GET = async (context: APIContext) => {
  const requested = context.params.image ?? "";
  const key = file.exec(requested)?.groups?.key ?? "";
  const images = await loadImages();
  const definition = images[key];
  if (!definition) {
    return empty(404);
  }
  const image = await prepareImage(key, definition);
  if (image.file !== requested) {
    return empty(307, {
      "Cache-Control": "public, max-age=300",
      Location: `${config.route}/${image.file}`,
    });
  }
  let bytes: Awaited<ReturnType<typeof renderPrepared>>;
  try {
    // On demand, every URL renders once and the cache serves it after that, so its images stay
    // out of Takumi's decode cache; a build renders many images and reuses their decodes.
    bytes = await renderPrepared(
      image,
      context.url,
      context.isPrerendered ? "auto" : "none"
    );
  } catch (error) {
    console.error(`astro-takumi-images: rendering ${requested} failed`, error);
    return empty(500);
  }
  // Astro's route cache, where the adapter provides one, keeps the image at the edge.
  if (context.cache?.enabled) {
    context.cache.set({
      maxAge: config.cacheMaxAge,
      tags: ["takumi-images", ...config.cacheTags],
    });
  }
  return new Response(bytes, {
    headers: {
      "Cache-Control": `public, max-age=${config.cacheMaxAge}, immutable`,
      "Content-Type": contentTypeOf(definition),
    },
  });
};
