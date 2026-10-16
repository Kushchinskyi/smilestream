import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import assert from "node:assert/strict";
async function contents(root) {
  let text = "";
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) text += await contents(path);
    else if (/\.(js|mjs|html|json|css)$/.test(entry.name)) text += await readFile(path, "utf8");
  }
  return text;
}
const production = await contents(".output");
const media = await contents(".media-test-output");
assert(!production.includes("LOCAL MEDIA TEST"), "Production contains test UI");
assert(!production.includes("samplelib.com"), "Production contains media fixtures");
assert(media.includes("LOCAL MEDIA TEST"), "Missing test harness");
for (const forbidden of [
  "ieytvixchndxnxsxpcot",
  "supabase.co",
  "supabase-js",
  "SMILE_ISOLATION_CANARY",
])
  assert(!media.includes(forbidden), `Isolated output contains ${forbidden}`);
console.log(
  "PASS: normal production output excludes test mode; media output excludes Supabase and env canary",
);
