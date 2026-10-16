import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { testBackend } from "./test-target.mjs";
const args = process.argv.slice(2);
if (args.some((a) => !["--lan", "--staging", "--preview"].includes(a)))
  throw new Error("Supported flags: --lan, --staging, --preview");
const { endpoint, key } = testBackend(process.env, args.includes("--staging"));
const host = args.includes("--lan") ? "0.0.0.0" : "127.0.0.1";
const preview = args.includes("--preview");
const env = {
  ...process.env,
  VITE_SUPABASE_URL: endpoint,
  VITE_SUPABASE_PUBLISHABLE_KEY: key,
  SUPABASE_URL: endpoint,
  SUPABASE_PUBLISHABLE_KEY: key,
};
if (preview) {
  // Local process only: never change the project's production/Lovable preset.
  env.NITRO_PRESET = "node-server";
  env.PORT = "4173";
  env.NITRO_PORT = "4173";
  env.HOST = host;
  env.NITRO_HOST = host;
}
let child;
function run(
  commandArgs,
  entry = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url)),
) {
  return new Promise((resolve) => {
    child = spawn(process.execPath, [entry, ...commandArgs], {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      stdio: "inherit",
      env,
    });
    child.on("error", () => resolve(1));
    child.on("exit", (code) => resolve(code ?? 1));
  });
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child?.kill(signal));
console.log("Local test only: http://127.0.0.1:4173/tv");
console.log(
  endpoint
    ? "Using the explicitly supplied test backend."
    : "Backend disabled. No playlist or music is fetched; supply a test backend to test real media.",
);
if (host === "0.0.0.0")
  console.log("LAN enabled: open http://<computer-LAN-IP>:4173/tv on the TV.");
const built = !preview || (await run(["build", "--mode", "local-test"])) === 0;
if (!built) process.exitCode = 1;
else if (preview)
  process.exitCode = await run(
    [],
    fileURLToPath(new URL("../.output/server/index.mjs", import.meta.url)),
  );
else
  process.exitCode = await run([
    "dev",
    "--mode",
    "local-test",
    "--host",
    host,
    "--port",
    "4173",
    "--strictPort",
    "--clearScreen",
    "false",
  ]);
