import type { experimental_AstroContainer } from "astro/container";
import { experimental_getFontFileURL, fontData } from "astro:assets";
import { render, renderAnimation } from "takumi-js";
import type { FontLoader, RenderOptions } from "takumi-js";
import { backend } from "virtual:astro-takumi-images/backend";
import { config } from "virtual:astro-takumi-images/config";
import stylesheets from "virtual:astro-takumi-images/css";
import { renderReact } from "virtual:astro-takumi-images/react";

import { toTakumiCss } from "../css.js";
import { sizePresets } from "../types.js";
import type {
  ImageComponent,
  ImageConfig,
  ImageParams,
  ImageSize,
} from "../types.js";
import { matchTemplate } from "./templates.js";

// ---------------------------------------------------------------------------------------------
// Markup: React and Astro components render to HTML as on the server, which Takumi then draws.

let astroContainer: Promise<experimental_AstroContainer> | undefined;

const createContainer = async () => {
  const { experimental_AstroContainer: Container } =
    await import("astro/container");
  return Container.create();
};

const isAstroComponent = (component: ImageComponent) =>
  "isAstroComponentFactory" in component &&
  component.isAstroComponentFactory === true;

/**
 * Renders a template with its route parameters, as Astro renders a page: `Astro.params` in an
 * Astro template, a `params` prop for a React one, which may be async and fetch its own data.
 */
const toHtml = async (
  component: ImageComponent,
  params: ImageParams,
  url: URL
) => {
  if (isAstroComponent(component)) {
    astroContainer ??= createContainer();
    const container = await astroContainer;
    return container.renderToString(
      component as Parameters<typeof container.renderToString>[0],
      {
        params,
        request: new Request(url),
      }
    );
  }
  if (!renderReact) {
    throw new Error(
      "astro-takumi-images: a React template needs `react` and `react-dom` in the project."
    );
  }
  return renderReact(component, { params });
};

// ---------------------------------------------------------------------------------------------
// Fonts: the families of Astro's Fonts API, registered under their CSS variable, so the page's
// font stacks such as `var(--font-sans, …)` resolve to the same files in the image.

const familyOf = (variable: string) => variable.replace(/^--/u, "");
const fontFormats = new Set([
  "woff2",
  "woff",
  "truetype",
  "opentype",
  "ttf",
  "otf",
]);
const fontFiles = new Map<string, Promise<ArrayBuffer>>();

const download = async (url: string) => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `astro-takumi-images: font ${url} answered ${response.status}`
      );
    }
    return await response.arrayBuffer();
  } catch (error) {
    // A failed download is not kept, so the next render tries again.
    fontFiles.delete(url);
    throw error;
  }
};

/** Downloads each font file once per process or isolate. */
const fetchFont = (url: string) => {
  let file = fontFiles.get(url);
  if (!file) {
    file = download(url);
    fontFiles.set(url, file);
  }
  return file;
};

const astroFonts = (requestUrl: URL | undefined): FontLoader[] =>
  Object.entries(fontData).flatMap(([variable, faces]) => {
    // Faces by file: a file that serves several weights is a variable font.
    const files = new Map<
      string,
      { style: string | undefined; weights: Set<string> }
    >();
    for (const face of faces) {
      const source = face.src.find(
        (src) => !src.format || fontFormats.has(src.format)
      );
      if (source) {
        const file = files.get(source.url) ?? {
          style: face.style,
          weights: new Set(),
        };
        file.weights.add(face.weight ?? "");
        files.set(source.url, file);
      }
    }
    return [...files].map(([url, file]) => {
      const [only] = file.weights;
      const weight = file.weights.size === 1 ? Number(only) : Number.NaN;
      return {
        data: () => fetchFont(experimental_getFontFileURL(url, requestUrl)),
        name: familyOf(variable),
        style: file.style === "italic" ? "italic" : "normal",
        // Without a weight, a variable font keeps its axes live; with one, a static file keeps
        // the weight Astro declared, including for a range such as `100 900`.
        weight: Number.isFinite(weight) ? weight : undefined,
      } satisfies FontLoader;
    });
  });

const fontVariables = () =>
  `:root { ${Object.keys(fontData)
    .map((variable) => `${variable}: "${familyOf(variable)}"`)
    .join("; ")} }`;

// ---------------------------------------------------------------------------------------------
// Size and CSS.

let ratioScalesOutput: Promise<boolean> | undefined;

/**
 * takumi-js 2.14 keeps `width` and `height` as output pixels and scales the layout by
 * `devicePixelRatio`; its documentation describes scaling the output instead. One raw 2 × 1
 * render tells which applies, so sizes stay the same across Takumi updates.
 */
const detectRatioScaling = async () => {
  const pixels = await render("<div></div>", {
    ...backend,
    devicePixelRatio: 2,
    format: "raw",
    height: 1,
    width: 2,
  });
  return pixels.length > 2 * 1 * 4;
};

const sizeOf = (definition: ImageConfig): ImageSize => {
  const { size = "og" } = definition;
  return typeof size === "string" ? sizePresets[size] : size;
};

const baseCss = new Map<string, string>();

const cssFor = (canvas: { width: number; height: number }) => {
  const key = `${canvas.width}x${canvas.height}`;
  let css = baseCss.get(key);
  if (css === undefined) {
    const joined = stylesheets.join("\n");
    css = config.tailwind ? toTakumiCss(joined, canvas) : joined;
    baseCss.set(key, css);
  }
  return css;
};

const digest = async (text: string) => {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const cssDigests = new Map<string, Promise<string>>();

const digestOnce = (css: string) => {
  let hash = cssDigests.get(css);
  if (!hash) {
    hash = digest(css);
    cssDigests.set(css, hash);
  }
  return hash;
};

/** The format an image renders in: PNG by default, animated WebP for an animation. */
export const formatOf = (definition: ImageConfig) =>
  definition.format ?? (definition.animation ? "webp" : "png");

export const extensionOf = (definition: ImageConfig) => {
  const format = formatOf(definition);
  return format === "jpeg" ? "jpg" : format;
};

export const contentTypeOf = (definition: ImageConfig) =>
  `image/${formatOf(definition)}`;

/** An image ready to render: its markup, its CSS, and the checksum of both. */
export interface PreparedImage {
  definition: ImageConfig;
  html: string;
  css: string[];
  size: ImageSize;
  hash: string;
  /** Path below the route, such as `blog/hello.3f9a1c2e7b04.png`. */
  file: string;
}

/**
 * Renders the template of an image path, such as `blog/hello`, to HTML and computes the checksum
 * of everything the image is made of: the HTML, the CSS, the font files, the size, the encoding,
 * and the renderer. The file name carries it, so a changed post, template, theme, or font yields
 * a new URL by itself. `undefined` when no template answers the path.
 */
export const prepareImage = async (
  path: string,
  origin: URL | string = "http://localhost"
): Promise<PreparedImage | undefined> => {
  const matched = matchTemplate(path);
  if (!matched) {
    return undefined;
  }
  const template = await matched.template.load();
  const definition = template.image ?? {};
  const size = sizeOf(definition);
  const ratio = size.devicePixelRatio ?? 1;
  const canvas = { height: size.height / ratio, width: size.width / ratio };
  const html = await toHtml(
    template.default,
    matched.params,
    new URL(`${config.route}/${path}`, origin)
  );
  const css = [cssFor(canvas)];
  if (definition.css) {
    css.push(
      config.tailwind ? toTakumiCss(definition.css, canvas) : definition.css
    );
  }
  if (config.fonts) {
    css.unshift(fontVariables());
  }
  const hash = await digest(
    [
      html,
      await digestOnce(css.join("\n")),
      JSON.stringify({
        animation: definition.animation,
        fonts: config.fonts ? fontData : null,
        format: formatOf(definition),
        quality: "quality" in definition ? definition.quality : undefined,
        renderer: config.renderer,
        size,
        version: definition.version,
      }),
    ].join("\n")
  );
  const shortHash = hash.slice(0, 12);
  return {
    css,
    definition,
    file: `${path}.${shortHash}.${extensionOf(definition)}`,
    hash: shortHash,
    html,
    size,
  };
};

/** Draws a prepared image with Takumi on the configured backend. */
export const renderPrepared = async (
  image: PreparedImage,
  requestUrl: URL | undefined,
  decodeCache: "auto" | "none"
) => {
  const { definition, size } = image;
  const ratio = size.devicePixelRatio ?? 1;
  ratioScalesOutput ??= detectRatioScaling();
  const scaled = await ratioScalesOutput;
  const shared = {
    ...backend,
    css: image.css,
    devicePixelRatio: ratio,
    fonts: config.fonts ? astroFonts(requestUrl) : [],
    height: scaled ? size.height / ratio : size.height,
    width: scaled ? size.width / ratio : size.width,
  };
  const quality = "quality" in definition ? definition.quality : undefined;
  if (definition.animation) {
    const format = formatOf(definition);
    // An animation plays the template's CSS animations; it is one scene of the given length.
    const timeline = {
      ...shared,
      fps: definition.animation.fps ?? 30,
      scenes: [{ durationMs: definition.animation.duration, node: image.html }],
    };
    // Takumi types each animation format separately, and only WebP takes a quality.
    if (format === "apng") {
      return renderAnimation({ ...timeline, format: "apng" });
    }
    if (format === "gif") {
      return renderAnimation({ ...timeline, format: "gif" });
    }
    return renderAnimation({ ...timeline, format: "webp", quality });
  }
  // Takumi types each format separately, and PNG takes no quality.
  let encoding:
    | { format: "png" }
    | { format: "jpeg"; quality?: number }
    | { format: "webp"; quality?: number } = { format: "png" };
  if (definition.format === "jpeg" || definition.format === "webp") {
    encoding = { format: definition.format, quality };
  }
  const options: RenderOptions = {
    ...shared,
    ...encoding,
    images: definition.images ?? { cache: decodeCache },
  };
  return render(image.html, options);
};
