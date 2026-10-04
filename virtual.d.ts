// Ambient module declarations cannot import types, so they reference them inline.
// oxlint-disable typescript/consistent-type-imports

declare module "virtual:astro-takumi-images/config" {
  export const config: import("./src/types.ts").RuntimeConfig;
}

declare module "virtual:astro-takumi-images/templates" {
  export const templateFiles: Record<string, () => Promise<unknown>>;
}

declare module "virtual:astro-takumi-images/css" {
  const stylesheets: string[];
  export default stylesheets;
}

declare module "virtual:astro-takumi-images/backend" {
  export const backend: {
    renderer?: InstanceType<typeof import("takumi-js/node").Renderer>;
    module?: Promise<unknown>;
  };
}

declare module "virtual:astro-takumi-images/react" {
  export const renderReact:
    | ((
        component: import("./src/types.ts").ImageComponent,
        props: Record<string, unknown>
      ) => Promise<string>)
    | undefined;
}
