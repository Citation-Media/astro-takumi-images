import { expect, test } from "vitest";

import { siteFetch } from "../../src/runtime/site-fetch.ts";

const site = "https://example.com";

/** A fetch that answers with where the request went, and records it. */
const recorder = (name: string, status = 200) => {
  const calls: string[] = [];
  const answer = (input: RequestInfo | URL) => {
    calls.push(new Request(input).url);
    return Promise.resolve(new Response(name, { status }));
  };
  return { answer, calls };
};

test("the site's own files come from the assets, everything else from the network", async () => {
  const assets = recorder("assets");
  const network = recorder("network");
  const fetch = siteFetch({
    fetch: network.answer,
    origins: [site, "https://preview.example.dev"],
    readAsset: assets.answer,
  });
  const font = await fetch(`${site}/_astro/fonts/inter.woff2`);
  expect(await font.text()).toBe("assets");
  const preview = await fetch("https://preview.example.dev/images/a.png");
  expect(await preview.text()).toBe("assets");
  const remote = await fetch("https://fonts.example.org/inter.woff2");
  expect(await remote.text()).toBe("network");
  expect(assets.calls).toEqual([
    `${site}/_astro/fonts/inter.woff2`,
    "https://preview.example.dev/images/a.png",
  ]);
  expect(network.calls).toEqual(["https://fonts.example.org/inter.woff2"]);
});

test("a file the assets do not have, such as a route's answer, comes from the network", async () => {
  const network = recorder("network");
  const fetch = siteFetch({
    fetch: network.answer,
    origins: [site],
    readAsset: recorder("missing", 404).answer,
  });
  const image = await fetch(`${site}/og/card.0123456789ab.png`);
  expect(await image.text()).toBe("network");
});

test("without an asset reader, as off Cloudflare or in development, every request goes to the network", async () => {
  const network = recorder("network");
  const fetch = siteFetch({
    fetch: network.answer,
    origins: [site, undefined],
    readAsset: undefined,
  });
  await fetch(`${site}/_astro/fonts/inter.woff2`);
  expect(network.calls).toEqual([`${site}/_astro/fonts/inter.woff2`]);
});
