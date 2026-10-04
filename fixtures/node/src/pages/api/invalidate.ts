import type { APIContext } from "astro";

// Test helper standing in for a webhook: invalidates the pages that link an image.
export const POST = async ({ cache, url }: APIContext) => {
  await cache.invalidate({ tags: [url.searchParams.get("tag") ?? ""] });
  return new Response(null, { status: 204 });
};
