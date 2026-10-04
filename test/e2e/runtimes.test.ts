import { execFile, spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterEach, describe, expect, test } from "vitest";

const run = promisify(execFile);
const fixtures = fileURLToPath(new URL("../../fixtures/", import.meta.url));
const astro = fileURLToPath(
  new URL("../../node_modules/.bin/astro", import.meta.url)
);
const timeout = 240_000;

const build = async (fixture: string, env: Record<string, string> = {}) => {
  await run(astro, ["build"], {
    cwd: path.join(fixtures, fixture),
    env: { ...process.env, ...env },
    maxBuffer: 32 * 1024 * 1024,
  });
};

/** Width and height from a PNG header. */
const pngSize = (bytes: Uint8Array) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { height: view.getUint32(20), width: view.getUint32(16) };
};

const servers: ChildProcess[] = [];

afterEach(() => {
  for (const server of servers.splice(0)) {
    server.kill();
  }
});

const serve = async (
  command: string,
  args: string[],
  cwd: string,
  port: number
) => {
  const server = spawn(command, args, {
    cwd,
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) },
    stdio: "ignore",
  });
  servers.push(server);
  const origin = `http://127.0.0.1:${port}`;
  // Polls until the server answers; each attempt has to wait for the one before.
  // oxlint-disable no-await-in-loop, promise/avoid-new, no-promise-executor-return
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      // An unknown image answers 404 uncached, so waiting leaves the page cache untouched.
      await fetch(`${origin}/og/missing.000000000000.png`);
      return origin;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  // oxlint-enable no-await-in-loop, promise/avoid-new, no-promise-executor-return
  throw new Error(`${command} did not start on ${origin}`);
};

/** The image URLs of `<Image>` and `<Picture>` on the fixture's picture page. */
const pictureSources = (html: string) => [
  ...new Set(
    [...html.matchAll(/(?:src|srcset)="(?<urls>[^"]*)"/gu)].flatMap((match) =>
      (match.groups?.urls ?? "")
        .split(",")
        .map(
          (candidate) =>
            candidate.trim().split(" ")[0]?.replaceAll("&amp;", "&") ?? ""
        )
        .filter(
          (url) => url.startsWith("/_image") || url.startsWith("/og/thumbnail/")
        )
    )
  ),
];

/** Checks that Astro's image service turned the Takumi source into AVIF, WebP, and PNG. */
const expectPicture = async (origin: string) => {
  const response = await fetch(`${origin}/picture`);
  const sources = pictureSources(await response.text());
  expect(sources.length).toBeGreaterThanOrEqual(6);
  const types = await Promise.all(
    sources.map(async (source) => {
      const image = await fetch(`${origin}${source}`);
      expect(image.status).toBe(200);
      return image.headers.get("content-type");
    })
  );
  expect(new Set(types)).toEqual(
    new Set(["image/avif", "image/webp", "image/png"])
  );
};

/** Checks the on-demand route: the current URL renders, an old one redirects, an unknown one is missing. */
const expectOnDemand = async (origin: string) => {
  const response = await fetch(origin);
  const page = await response.text();
  const png = /\/og\/react\/card\.[\da-f]{12}\.png/u.exec(page)?.[0];
  const webp = /\/og\/astro\/card\.[\da-f]{12}\.webp/u.exec(page)?.[0];
  expect(png).toBeDefined();
  expect(webp).toBeDefined();

  const image = await fetch(`${origin}${png}`);
  expect(image.status).toBe(200);
  expect(image.headers.get("content-type")).toBe("image/png");
  expect(image.headers.get("cache-control")).toBe(
    "public, max-age=31536000, immutable"
  );
  expect(pngSize(new Uint8Array(await image.arrayBuffer()))).toEqual({
    height: 630,
    width: 1200,
  });

  const thumbnail = await fetch(`${origin}${webp}`);
  expect(thumbnail.status).toBe(200);
  expect(thumbnail.headers.get("content-type")).toBe("image/webp");

  // A dynamic template answers any parameter on demand, not only those of getStaticPaths.
  const guessed = await fetch(`${origin}/og/blog/any-post.000000000000.png`, {
    redirect: "manual",
  });
  expect(guessed.status).toBe(307);
  const dynamic = await fetch(`${origin}${guessed.headers.get("location")}`);
  expect(dynamic.status).toBe(200);
  expect(dynamic.headers.get("content-type")).toBe("image/png");

  const outdated = await fetch(`${origin}/og/react/card.000000000000.png`, {
    redirect: "manual",
  });
  expect(outdated.status).toBe(307);
  expect(outdated.headers.get("location")).toBe(png);

  const unknown = await fetch(`${origin}/og/missing.000000000000.png`);
  expect(unknown.status).toBe(404);
  expect(unknown.headers.get("cache-control")).toBe("no-store");
};

const which = async (command: string) => {
  try {
    await run(command, ["--version"]);
    return true;
  } catch {
    return false;
  }
};

const hasBun = await which("bun");
const hasDeno = await which("deno");

describe("static output", () => {
  test(
    "prerenders the current images with checksum names and an immutable cache rule",
    async () => {
      await build("static");
      const dist = path.join(fixtures, "static/dist");
      const react = readdirSync(path.join(dist, "og/react"));
      expect(react).toHaveLength(1);
      expect(react[0]).toMatch(/^card\.[\da-f]{12}\.png$/u);
      const bytes = readFileSync(path.join(dist, "og/react", react[0] ?? ""));
      expect(pngSize(bytes)).toEqual({ height: 630, width: 1200 });
      expect(readdirSync(path.join(dist, "og/astro"))[0]).toMatch(
        /^card\.[\da-f]{12}\.webp$/u
      );
      expect(readFileSync(path.join(dist, "index.html"), "utf-8")).toContain(
        `content="/og/react/${react[0]}"`
      );
      expect(readFileSync(path.join(dist, "_headers"), "utf-8")).toContain(
        "/og/*\n  Cache-Control: public, max-age=31536000, immutable"
      );
    },
    timeout
  );
});

describe("on demand", () => {
  for (const runtime of ["auto", "native", "wasm"]) {
    test(
      `Node.js with the ${runtime} backend`,
      async () => {
        await build("node", { TAKUMI_RUNTIME: runtime });
        const cwd = path.join(fixtures, "node");
        await expectOnDemand(
          await serve(process.execPath, ["dist/server/entry.mjs"], cwd, 4410)
        );
      },
      timeout
    );
  }

  test(
    "the page cache keeps pages, and invalidating an image tag renders them again",
    async () => {
      await build("node");
      const cwd = path.join(fixtures, "node");
      const origin = await serve(
        process.execPath,
        ["dist/server/entry.mjs"],
        cwd,
        4414
      );
      const runs = async () => {
        const response = await fetch(`${origin}/api/runs`);
        const body: { runs: number } = await response.json();
        return body.runs;
      };
      const page = async () => {
        const response = await fetch(origin);
        await response.text();
        return response.headers.get("x-astro-cache");
      };
      expect(await page()).toBe("MISS");
      expect(await runs()).toBe(1);
      expect(await page()).toBe("HIT");
      expect(await page()).toBe("HIT");
      // The template did not run again while the page came from the cache.
      expect(await runs()).toBe(1);
      const invalidated = await fetch(
        `${origin}/api/invalidate?tag=og-image:blog/hello`,
        {
          headers: { origin },
          method: "POST",
        }
      );
      expect(invalidated.status).toBe(204);
      expect(await page()).toBe("MISS");
      expect(await runs()).toBe(2);
      expect(await page()).toBe("HIT");
    },
    timeout
  );

  test.runIf(hasBun)(
    "Bun",
    async () => {
      await build("node");
      const cwd = path.join(fixtures, "node");
      await expectOnDemand(
        await serve("bun", ["dist/server/entry.mjs"], cwd, 4411)
      );
    },
    timeout
  );

  test.runIf(hasDeno)(
    "Deno",
    async () => {
      await build("node");
      const cwd = path.join(fixtures, "node");
      await expectOnDemand(
        await serve("deno", ["run", "-A", "dist/server/entry.mjs"], cwd, 4412)
      );
    },
    timeout
  );

  test(
    "Cloudflare Workers (workerd)",
    async () => {
      await build("cloudflare");
      const cwd = path.join(fixtures, "cloudflare");
      expect(existsSync(path.join(cwd, "dist/server/wrangler.json"))).toBe(
        true
      );
      const origin = await serve(
        astro,
        ["preview", "--host", "127.0.0.1", "--port", "4413"],
        cwd,
        4413
      );
      try {
        await expectOnDemand(origin);
        // Cloudflare Images through the adapter's IMAGES binding.
        await expectPicture(origin);
      } finally {
        await run(astro, ["preview", "stop"], { cwd }).catch(() => {});
      }
    },
    timeout
  );
});
