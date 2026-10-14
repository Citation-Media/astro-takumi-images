/** Reads a file the site was built with, as Cloudflare's `ASSETS` binding does. */
export type AssetReader = (request: Request) => Promise<Response>;

/**
 * A `fetch` for everything an image loads while it renders, its font files and the images its
 * template names: a request for one of the site's own origins goes to `readAsset` first, which
 * reads the built file without leaving the runtime, and to `fetch` where that has no such file
 * (404) or there is no reader. Every other request goes to `fetch`.
 *
 * On Cloudflare the site's own files must not go through the network: a Worker cannot fetch its
 * own Custom Domain, since the request passes the Worker for an origin behind the domain, which
 * a site served by the Worker alone does not have (522). An address behind Cloudflare Access,
 * such as a Preview's, would answer with its login instead.
 */
export const siteFetch =
  ({
    fetch: fetchOut = globalThis.fetch,
    origins,
    readAsset,
  }: {
    /** The site's own origins, such as the request's and `site`'s. */
    origins: readonly (string | undefined)[];
    readAsset: AssetReader | undefined;
    fetch?: typeof globalThis.fetch;
  }): typeof globalThis.fetch =>
  async (input, init) => {
    const request = new Request(input, init);
    if (readAsset && origins.includes(new URL(request.url).origin)) {
      const asset = await readAsset(request.clone());
      if (asset.status !== 404) {
        return asset;
      }
    }
    return await fetchOut(request);
  };
