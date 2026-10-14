import { handle } from "@astrojs/cloudflare/handler";

/**
 * Cloudflare does not hand a Worker's fetch of its own Custom Domain back to the Worker: it goes
 * to an origin behind the domain, which a site served by the Worker alone does not have. Locally
 * the fetch would reach the preview server, so this Worker refuses the files the build wrote on
 * its own host as Cloudflare would; the images must read them from the assets instead.
 */
const fetchOut = globalThis.fetch;
let ownHost: string | undefined;
globalThis.fetch = async (input, init) => {
  const url = new URL(new Request(input, init).url);
  if (url.host === ownHost && url.pathname.startsWith("/_astro/")) {
    return new Response(null, { status: 522 });
  }
  return await fetchOut(input, init);
};

export default {
  fetch(...[request, ...rest]: Parameters<typeof handle>) {
    ownHost = new URL(request.url).host;
    return handle(request, ...rest);
  },
};
