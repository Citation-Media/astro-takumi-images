/** Canvas of a Takumi render in CSS pixels, which container queries and units resolve against. */
export interface TakumiCanvas {
  width: number;
  height: number;
}

const rootFontSize = 16;
const simpleFunction = /\b(?<name>clamp|max|min)\((?<args>[^()]*)\)/gu;
const term = /^(?<value>[+-]?(?:\d+\.?\d*|\.\d+))(?<unit>[a-z]*)$/u;

/** Pixels of one unit; `undefined` for units that depend on the element, such as `%` or `em`. */
const unitSize = (unit: string, canvas: TakumiCanvas) => {
  const inline = canvas.width / 100;
  const block = canvas.height / 100;
  const sizes = new Map([
    ["", 1],
    ["cqb", block],
    ["cqh", block],
    ["cqi", inline],
    ["cqmax", Math.max(inline, block)],
    ["cqmin", Math.min(inline, block)],
    ["cqw", inline],
    ["px", 1],
    ["rem", rootFontSize],
    ["vh", block],
    ["vmax", Math.max(inline, block)],
    ["vmin", Math.min(inline, block)],
    ["vw", inline],
  ]);
  return sizes.get(unit);
};

/** Sums an argument such as `2.086rem + 4.062cqi`; `undefined` if it holds anything else. */
const evaluate = (argument: string, canvas: TakumiCanvas) => {
  const parts = argument
    .trim()
    .replaceAll(/\s+(?<sign>[+-])\s+/gu, " $<sign>")
    .split(/\s+/u);
  let pixels = 0;
  let unitless = true;
  for (const part of parts) {
    const { value, unit = "" } = term.exec(part)?.groups ?? {};
    const size = unitSize(unit, canvas);
    if (value === undefined || size === undefined) {
      return;
    }
    unitless &&= unit === "";
    pixels += Number(value) * size;
  }
  return { pixels, unitless };
};

/** Resolves `clamp()`, `min()`, and `max()` of plain lengths, innermost first. */
const resolveComparisons = (css: string, canvas: TakumiCanvas) => {
  let current = css;
  let previous = "";
  while (current !== previous) {
    previous = current;
    current = current.replaceAll(simpleFunction, (match, name, args) => {
      const values = String(args)
        .split(",")
        .map((argument) => evaluate(argument, canvas));
      if (values.some((value) => value === undefined)) {
        return match;
      }
      const resolved = values.filter((value) => value !== undefined);
      const unitless = resolved.every((value) => value.unitless);
      if (!unitless && resolved.some((value) => value.unitless)) {
        return match;
      }
      const pixels = resolved.map((value) => value.pixels);
      const [low = 0, preferred = 0, high = 0] = pixels;
      const result =
        name === "clamp"
          ? Math.max(low, Math.min(preferred, high))
          : Math[name === "min" ? "min" : "max"](...pixels);
      const rounded = Math.round(result * 1000) / 1000;
      return unitless ? String(rounded) : `${rounded}px`;
    });
  }
  return current;
};

const registration = /@property\s+(?<name>--[\w-]+)\s*\{(?<body>[^}]*)\}/gu;
const initialValue = /initial-value\s*:\s*(?<value>[^;]+?)\s*(?:;|$)/u;

/**
 * Takumi ignores the `initial-value` of registered `--tw-*` properties, which Tailwind v4 uses
 * for the defaults of gradients, shadows, and transforms; a rule on every element sets them.
 */
const initialValues = (css: string) => {
  const declarations = [...css.matchAll(registration)].flatMap((match) => {
    const { name = "", body = "" } = match.groups ?? {};
    const value = initialValue.exec(body)?.groups?.value;
    return value === undefined ? [] : [`${name}: ${value}`];
  });
  // In the first layer, as Tailwind's own fallback, so every utility and unlayered rule wins.
  return declarations.length > 0
    ? `@layer properties { *, ::before, ::after { ${declarations.join("; ")} } }\n`
    : "";
};

/**
 * Adapts a compiled Tailwind stylesheet to what Takumi's engine supports, for one canvas size:
 *
 * - `clamp()`, `min()`, and `max()` of plain lengths resolve to pixels, so the fluid display sizes
 *   and `p-card` keep their values.
 * - Container queries and container units follow the canvas, as they follow the viewport in a
 *   browser when no container is set.
 * - The `dark:` variant's `:is(.dark *)` becomes a `.dark` descendant selector.
 * - `content` drops its alternative text (`"/" / ""`), which Takumi does not parse.
 * - Line breaks before a closing parenthesis go, because Takumi then drops the declaration, such
 *   as the multi-line font stacks of an unminified build.
 * - The `initial-value` of registered properties becomes a declaration on every element.
 */
export const toTakumiCss = (css: string, canvas: TakumiCanvas) =>
  resolveComparisons(
    initialValues(css) + css.replaceAll(/\s*\n\s*\)/gu, ")"),
    canvas
  )
    .replaceAll(/(?<=\d)cq(?:i|w)\b/gu, "vw")
    .replaceAll(/(?<=\d)cq(?:b|h)\b/gu, "vh")
    .replaceAll(/(?<=\d)cq(?<extreme>min|max)\b/gu, "v$<extreme>")
    .replaceAll(/@container\s+(?:[\w-]+\s+)?(?=\()/gu, "@media ")
    .replaceAll(
      /(?<selector>[^\s{},;][^{},;]*?):is\(\.dark \*\)/gu,
      ".dark $<selector>"
    )
    .replaceAll(
      /content:\s*(?<text>"[^"]*"|'[^']*')\s*\/\s*(?:"[^"]*"|'[^']*')/gu,
      "content: $<text>"
    );
