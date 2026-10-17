import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { integrationBackend, INTEGRATION_PROJECT } from "./integration-target.mjs";
import { mediaTestEnvironment } from "./media-test/guard.mjs";
const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--lan")) throw new Error("Only --lan is supported");
const config = JSON.parse(
  (await readFile(new URL("../smile-integration.local", import.meta.url), "utf8")).replace(
    /^\uFEFF/,
    "",
  ),
);
const backend = integrationBackend(config);
const host = args.includes("--lan") ? "0.0.0.0" : "127.0.0.1";
const env = {
  ...mediaTestEnvironment(process.env, []),
  SMILE_INTEGRATION_PROJECT: INTEGRATION_PROJECT,
  VITE_SUPABASE_PROJECT_ID: INTEGRATION_PROJECT,
  SUPABASE_PROJECT_ID: INTEGRATION_PROJECT,
  VITE_SUPABASE_URL: backend.endpoint,
  VITE_SUPABASE_PUBLISHABLE_KEY: backend.key,
  SUPABASE_URL: backend.endpoint,
  SUPABASE_PUBLISHABLE_KEY: backend.key,
  PORT: "4173",
  NITRO_PORT: "4173",
  HOST: host,
  NITRO_HOST: host,
};
let child;
function run(entry, args) {
  return new Promise((resolve) => {
    child = spawn(process.execPath, [fileURLToPath(new URL(entry, import.meta.url)), ...args], {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      stdio: "inherit",
      env,
    });
    child.on("error", () => resolve(1));
    child.on("exit", (code) => resolve(code ?? 1));
  });
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child?.kill(signal));
console.log(
  `ISOLATED INTEGRATION TEST: ${INTEGRATION_PROJECT}; production backend variables overridden.`,
);
const result = await run("../node_modules/vite/bin/vite.js", [
  "build",
  "--config",
  "vite.integration.config.mjs",
  "--mode",
  "integration-test",
]);
process.exitCode = result || (await run("../.integration-test-output/server/index.mjs", []));
