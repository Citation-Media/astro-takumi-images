import { appendFile, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { AstroIntegration } from "astro";
import type { Plugin } from "vite";

import type { RuntimeConfig } from "./types.js";

export { toTakumiCss } from "./css.js";
export type { TakumiCanvas } from "./css.js";
export { sizePresets } from "./types.js";
export type {
  ImageComponent,
  ImageDefinition,
  ImageEncoding,
  ImageMap,
  ImageSize,
  ImageSource,
  SizePreset,
} from "./types.js";

/**
 * Which Takumi backend renders:
 * - `auto` lets the runtime's export conditions decide: the native addon on Node.js and Bun,
 *   WebAssembly on workerd (Cloudflare), Deno, and other edge runtimes.
 * - `native` forces the native addon, for example on a Node.js platform whose bundler drops the
 *   `node` condition.
 * - `wasm` forces WebAssembly, for example on a Node.js host where the native addon for its CPU
 *   or libc is missing.
 */
export type TakumiRuntime = "auto" | "native" | "wasm";

export interface TakumiImagesOptions {
  /**
   * Module whose default export is the images, as a map or a function that builds one, such as
   * `./src/og-images.ts`. Paths are relative to the project root.
   */
  images: string;
  /** Path the images are served under. */
  route?: string;
  /**
   * Prerender the images during the build. Defaults to `true` for `output: "static"` and to
   * `false`, rendering on demand, for `output: "server"`.
   */
  prerender?: boolean;
  /** Takumi backend; see {@link TakumiRuntime}. */
  runtime?: TakumiRuntime;
  /** Register the families of Astro's Fonts API, so images use the same font files as pages. */
  fonts?: boolean;
  /**
   * Stylesheets the components need, compiled by Vite, such as the Tailwind entry
   * `./src/styles/global.css`. Paths are relative to the project root.
   */
  stylesheets?: string[];
  /** Globs of further stylesheets, such as CSS modules: `/src/components/**\/*.module.css`. */
  styleGlobs?: string[];
  /** Adapt the CSS to Takumi's engine (`clamp()`, container queries, `dark:`); see `toTakumiCss`. */
  tailwind?: boolean;
  /** Cache lifetime in seconds; URLs change with their content, so the default is one year. */
  cacheMaxAge?: number;
  /** Extra tags for Astro's route cache, besides `takumi-images`. */
  cacheTags?: string[];
  /**
   * Add a `_headers` rule that caches prerendered images forever on hosts that read it, such as
   * Cloudflare and Netlify. Static files lose the headers the route sets.
   */
  headersFile?: boolean;
}

const prefix = "virtual:astro-takumi-images/";
const modules = ["config", "images", "css", "backend", "react"] as const;

const backendModule = (runtime: TakumiRuntime) => {
  if (runtime === "native") {
    return `import { Renderer } from "takumi-js/node";\nexport const backend = { renderer: new Renderer() };`;
  }
  if (runtime === "wasm") {
    // A getter, so the WebAssembly binary loads on the first render, not with the route module.
    return `export const backend = { get module() { return import("@takumi-rs/wasm/auto"); } };`;
  }
  return "export const backend = {};";
};

/**
 * A project file as Vite resolves it: from the root, such as `/src/og-images.ts`, or by its
 * absolute path when it lies outside the root.
 */
const fromRoot = (root: string, file: string) => {
  const absolute = path.resolve(root, file);
  const relative = path.relative(root, absolute);
  return relative.startsWith("..")
    ? absolute.split(path.sep).join("/")
    : `/${relative.split(path.sep).join("/")}`;
};

/** A file's text, or `undefined` when it does not exist yet. */
const readExisting = async (file: string): Promise<string | undefined> => {
  try {
    return await readFile(file, "utf-8");
  } catch {
    // A missing file is created by the caller.
  }
};

const packageVersion = (require: NodeJS.Require, name: string) => {
  try {
    const manifest: { version?: string } = require(`${name}/package.json`);
    return manifest.version ?? "unknown";
  } catch {
    return "unknown";
  }
};

const canResolve = (root: string, specifier: string) => {
  try {
    createRequire(path.join(root, "package.json")).resolve(specifier);
    return true;
  } catch {
    return false;
  }
};

/**
 * Astro integration that serves images rendered by Takumi from your own React or Astro
 * components under `<route>/<key>.<checksum>.<extension>`. The checksum covers everything the
 * image is made of, so every URL is cached forever and a changed image gets a new URL; nothing
 * has to be purged. Images are prerendered for static sites and rendered on demand otherwise.
 */
export default function takumiImages(
  options: TakumiImagesOptions
): AstroIntegration {
  const route = `/${(options.route ?? "/og").replaceAll(/^\/+|\/+$/gu, "")}`;
  const runtime = options.runtime ?? "auto";
  let prerender = options.prerender ?? true;

  return {
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        if (!prerender || options.headersFile === false) {
          return;
        }
        const file = path.join(fileURLToPath(dir), "_headers");
        const rule = `${route}/*\n  Cache-Control: public, max-age=${options.cacheMaxAge ?? 31_536_000}, immutable\n`;
        const existing = await readExisting(file);
        if (existing?.includes(`${route}/*`)) {
          return;
        }
        await (existing === undefined
          ? writeFile(file, rule)
          : appendFile(file, `${existing.endsWith("\n") ? "" : "\n"}${rule}`));
        logger.info(`Added an immutable cache rule for ${route}/* to _headers`);
      },
      "astro:config:setup": ({ config, injectRoute, updateConfig }) => {
        const root = fileURLToPath(config.root);
        prerender = options.prerender ?? config.output === "static";
        const require = createRequire(import.meta.url);
        const runtimeConfig: RuntimeConfig = {
          cacheMaxAge: options.cacheMaxAge ?? 31_536_000,
          cacheTags: options.cacheTags ?? [],
          fonts: options.fonts ?? true,
          renderer: `astro-takumi-images@${packageVersion(require, "astro-takumi-images")} takumi-js@${packageVersion(require, "takumi-js")}`,
          route,
          tailwind: options.tailwind ?? true,
        };
        const stylesheetImports = (options.stylesheets ?? []).map(
          (sheet, index) =>
            `import sheet${index} from ${JSON.stringify(`${fromRoot(root, sheet)}?inline`)};`
        );
        const sources: Record<(typeof modules)[number], string> = {
          backend: backendModule(runtime),
          config: `export const config = ${JSON.stringify(runtimeConfig)};`,
          css: [
            ...stylesheetImports,
            `const globbed = ${
              options.styleGlobs?.length
                ? `Object.values(import.meta.glob(${JSON.stringify(options.styleGlobs)}, { eager: true, import: "default", query: "?inline" }))`
                : "[]"
            };`,
            `export default [${stylesheetImports.map((_, index) => `sheet${index}`).join(", ")}${stylesheetImports.length > 0 ? ", " : ""}...globbed];`,
          ].join("\n"),
          images: `export { default } from ${JSON.stringify(fromRoot(root, options.images))};`,
          react: canResolve(root, "react-dom/server")
            ? `import { createElement } from "react";\nimport { renderToStaticMarkup } from "react-dom/server";\nexport const renderReact = (component, props) => renderToStaticMarkup(createElement(component, props));`
            : "export const renderReact = undefined;",
        };
        const plugin: Plugin = {
          // The runtime imports the virtual modules and `astro:assets`, so every server
          // environment (Astro's prerender environment included) has to bundle it.
          configEnvironment(name) {
            return name === "client"
              ? undefined
              : { resolve: { noExternal: ["astro-takumi-images"] } };
          },
          enforce: "pre",
          load(id) {
            const name = id.startsWith(`\0${prefix}`)
              ? id.slice(prefix.length + 1)
              : undefined;
            return name && name in sources
              ? sources[name as keyof typeof sources]
              : undefined;
          },
          name: "astro-takumi-images",
          resolveId(id) {
            return id.startsWith(prefix) ? `\0${id}` : undefined;
          },
        };

        injectRoute({
          entrypoint: prerender
            ? "astro-takumi-images/route/static"
            : "astro-takumi-images/route/on-demand",
          pattern: `${route}/[...image]`,
          prerender,
        });
        updateConfig({
          vite: { plugins: [plugin] },
        });
      },
    },
    name: "astro-takumi-images",
  };
}
