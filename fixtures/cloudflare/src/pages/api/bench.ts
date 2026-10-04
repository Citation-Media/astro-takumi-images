// oxlint-disable no-await-in-loop -- renders run one after another, so timings do not overlap.
import { imageUrl, renderImage } from "astro-takumi-images/runtime";

// Benchmark helper: the cost of computing an image URL (template to HTML plus checksum) and of a
// full render (that plus Takumi drawing and encoding), cold and warm.
const time = async (task: () => Promise<unknown>) => {
  const start = performance.now();
  await task();
  return performance.now() - start;
};

const median = (values: number[]) =>
  values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;

export const GET = async ({ url }: { url: URL }) => {
  const coldRender = await time(() => renderImage("blog/cold", { url }));
  const runs = Array.from({ length: 20 }, (_, index) => index);
  const urlTimes: number[] = [];
  const og: number[] = [];
  const react: number[] = [];
  const thumbnail: number[] = [];
  for (const index of runs) {
    // Distinct slugs, so every render draws new text rather than repeating one image.
    urlTimes.push(await time(() => imageUrl(`blog/post-${index}`)));
    og.push(await time(() => renderImage(`blog/post-${index}`, { url })));
    react.push(await time(() => renderImage("react/card", { url })));
    thumbnail.push(await time(() => renderImage("astro/card", { url })));
  }
  return Response.json({
    coldFirstRenderMs: Math.round(coldRender),
    medianMs: {
      imageUrlOnly: +median(urlTimes).toFixed(1),
      ogPng1200x630Astro: +median(og).toFixed(1),
      ogPng1200x630React: +median(react).toFixed(1),
      thumbnailWebp1600x900: +median(thumbnail).toFixed(1),
    },
  });
};
