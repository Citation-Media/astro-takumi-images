import type { APIContext } from "astro";
import { config } from "virtual:astro-takumi-images/config";

import { contentTypeOf, prepareImage, renderPrepared } from "./render.js";
import { templates } from "./templates.js";

const file = /^(?<path>.+)\.(?<hash>[\da-f]{12})\.(?<extension>png|jpg|webp)$/u;

const empty = (status: number, headers: Record<string, string> = {}) =>
  new Response(null, {
    headers: { "Cache-Control": "no-store", ...headers },
    status,
  });

/** Every current image file, for the build to prerender: static templates and their params. */
export const getStaticPaths = async () => {
  const paths = await Promise.all(
    templates.map(async (template) => {
      if (!template.dynamic) {
        return [template.route];
      }
      const module = await template.load();
      if (!module.getStaticPaths) {
        console.warn(
          `astro-takumi-images: ${template.route} has parameters but no getStaticPaths, so no image is prerendered for it.`
        );
        return [];
      }
      const entries = await module.getStaticPaths();
      return entries.map((entry) => template.pathFor(entry.params));
    })
  );
  const images = await Promise.all(
    paths.flat().map((path) => prepareImage(path))
  );
  return images.flatMap((image) =>
    image ? [{ params: { image: image.file } }] : []
  );
};

/**
 * Serves `<route>/<path>.<checksum>.<extension>`. The current file renders and is cached forever,
 * since its URL changes with its content; a former checksum redirects to the current file, and a
 * failed render is never cached.
 */
export const GET = async (context: APIContext) => {
  const requested = context.params.image ?? "";
  const path = file.exec(requested)?.groups?.path;
  const image = path ? await prepareImage(path, context.url) : undefined;
  if (!image) {
    return empty(404);
  }
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
  // The URL never changes its content, so Astro's route cache may keep it as long as it likes.
  if (context.cache?.enabled) {
    context.cache.set({
      maxAge: config.cacheMaxAge,
      tags: [`og-image:${path}`],
    });
  }
  return new Response(bytes, {
    headers: {
      "Cache-Control": `public, max-age=${config.cacheMaxAge}, immutable`,
      "Content-Type": contentTypeOf(image.definition),
    },
  });
};
