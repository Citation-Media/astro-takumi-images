import { config } from "virtual:astro-takumi-images/config";
import { templateFiles } from "virtual:astro-takumi-images/templates";

import type { ImageParams, TemplateModule } from "../types.js";

/** A template file and the image paths it answers, as Astro routes pages. */
export interface Template {
  /** Path pattern relative to the route, such as `blog/[slug]`. */
  route: string;
  load: () => Promise<TemplateModule>;
  dynamic: boolean;
  matches: (path: string) => ImageParams | undefined;
  pathFor: (params: ImageParams) => string;
}

const extension = /\.(?:astro|[jt]sx)$/u;
const parameter = /\[(?<rest>\.\.\.)?(?<name>[^\]]+)\]/gu;
const escape = (text: string) =>
  text.replaceAll(/[$()*+.?[\\\]^{|}]/gu, "\\$&");

const toTemplate = (
  file: string,
  load: () => Promise<TemplateModule>
): Template => {
  const route = file.slice(config.templates.length).replace(extension, "");
  const names: string[] = [];
  let source = "";
  let last = 0;
  for (const match of route.matchAll(parameter)) {
    const { rest, name = "" } = match.groups ?? {};
    names.push(name);
    source += `${escape(route.slice(last, match.index))}(?<${name}>${rest ? ".+?" : "[^/]+?"})`;
    last = match.index + match[0].length;
  }
  source += escape(route.slice(last));
  const pattern = new RegExp(`^${source}$`, "u");
  return {
    dynamic: names.length > 0,
    load,
    matches: (path) => {
      const match = pattern.exec(path);
      return match ? { ...match.groups } : undefined;
    },
    pathFor: (params) =>
      route.replaceAll(parameter, (_, __, name: string) => params[name] ?? ""),
    route,
  };
};

// Like Astro: static paths before dynamic ones, single segments before rest parameters.
const rank = (template: Template) =>
  (template.route.match(/\[\.\.\./gu)?.length ?? 0) * 100 +
  (template.route.match(/\[/gu)?.length ?? 0);

export const templates: Template[] = Object.entries(templateFiles)
  .map(([file, load]) =>
    toTemplate(file, load as () => Promise<TemplateModule>)
  )
  .toSorted((a, b) => rank(a) - rank(b) || b.route.length - a.route.length);

/** The template for an image path, such as `blog/hello`, with its parameters. */
export const matchTemplate = (
  path: string
): { params: ImageParams; template: Template } | undefined => {
  for (const template of templates) {
    const params = template.matches(path);
    if (params) {
      return { params, template };
    }
  }
};
