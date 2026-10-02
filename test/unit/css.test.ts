import { expect, test } from "vitest";

import { toTakumiCss } from "../../src/css.ts";

const canvas = { height: 630, width: 1200 };

test("clamp, min, and max of plain lengths resolve to pixels for the canvas", () => {
  expect(
    toTakumiCss(
      ".a { font-size: clamp(3rem, 2.086rem + 4.062cqi, 4.625rem); }",
      canvas
    )
  ).toBe(".a { font-size: 74px; }");
  expect(
    toTakumiCss(".a { padding: clamp(1rem, 0.6667rem + 1.667cqi, 1.5rem); }", {
      height: 300,
      width: 400,
    })
  ).toBe(".a { padding: 17.335px; }");
  expect(
    toTakumiCss(".a { width: max(10px, min(50vw, 400px)); }", canvas)
  ).toBe(".a { width: 400px; }");
});

test("comparisons with element-relative values stay as written", () => {
  const css = ".a { width: min(100%, 40rem); height: clamp(1em, 2vw, 3em); }";
  expect(toTakumiCss(css, canvas)).toBe(css);
});

test("container queries and units follow the canvas", () => {
  expect(
    toTakumiCss(
      "@container (width >= 32rem) { .b { width: 50cqi; height: 10cqh; } }",
      canvas
    )
  ).toBe("@media (width >= 32rem) { .b { width: 50vw; height: 10vh; } }");
  expect(
    toTakumiCss(
      "@container sidebar (width >= 20rem) { .c { gap: 1rem; } }",
      canvas
    )
  ).toBe("@media (width >= 20rem) { .c { gap: 1rem; } }");
});

test("the dark variant becomes a descendant selector", () => {
  expect(
    toTakumiCss(
      "}\n  .dark\\:fill-white:is(.dark *) {\n    fill: white;\n  }",
      canvas
    )
  ).toBe("}\n  .dark .dark\\:fill-white {\n    fill: white;\n  }");
});

test("content drops its alternative text", () => {
  expect(toTakumiCss(".d::before { content: '/' / ''; }", canvas)).toBe(
    ".d::before { content: '/'; }"
  );
});

test("line breaks before a closing parenthesis are removed", () => {
  expect(
    toTakumiCss(
      '.e { font-family: var(\n    --font-mono,\n    "JetBrains Mono",\n    monospace\n  ); }',
      canvas
    )
  ).toBe(
    '.e { font-family: var(\n    --font-mono,\n    "JetBrains Mono",\n    monospace); }'
  );
});

test("initial values of registered properties apply in the first layer", () => {
  expect(
    toTakumiCss(
      '@property --tw-gradient-from-position{syntax:"<length-percentage>";inherits:false;initial-value:0%}\n.a { color: red; }',
      canvas
    ).split("\n")[0]
  ).toBe(
    "@layer properties { *, ::before, ::after { --tw-gradient-from-position: 0% } }"
  );
});
