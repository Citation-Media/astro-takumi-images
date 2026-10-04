// Test helper: how often the blog template ran.
export const GET = () =>
  Response.json({
    runs: (globalThis as { templateRuns?: number }).templateRuns ?? 0,
  });
