// oxlint-disable no-await-in-loop -- one backend at a time, on the same port.
// Builds the Node.js fixture and prints how long images take, per backend.
import { execFileSync, spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../fixtures/node/", import.meta.url));
const astro = fileURLToPath(
  new URL("../node_modules/.bin/astro", import.meta.url)
);

for (const runtime of ["native", "wasm"]) {
  execFileSync(astro, ["build"], {
    cwd,
    env: { ...process.env, TAKUMI_RUNTIME: runtime },
    stdio: "ignore",
  });
  const server = spawn(process.execPath, ["dist/server/entry.mjs"], {
    cwd,
    env: { ...process.env, HOST: "127.0.0.1", PORT: "4420" },
    stdio: "ignore",
  });
  await sleep(1500);
  const response = await fetch("http://127.0.0.1:4420/api/bench");
  console.log(`Node.js, ${runtime}:`, JSON.stringify(await response.json()));
  server.kill();
}
