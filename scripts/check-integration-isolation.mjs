import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { INTEGRATION_PROJECT, integrationBackend } from "./integration-target.mjs";
async function content(root) {
  let text = "";
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) text += await content(path);
    else if (/\.(js|mjs|html|json|css)$/.test(entry.name)) text += await readFile(path, "utf8");
  }
  return text;
}
const config = JSON.parse(
  (await readFile("smile-integration.local", "utf8")).replace(/^\uFEFF/, ""),
);
integrationBackend(config);
const integration = await content(".integration-test-output");
const ordinary = await content(".output");
const acceleratedLabel = "Локальний тест: рекламний інтервал 60 с";
assert(integration.includes(acceleratedLabel), "Integration clock alias was not included");
assert(!ordinary.includes(acceleratedLabel), "Accelerated ad clock leaked into ordinary build");
for (const secret of [config.adminPassword, config.userPassword, "SMILE_ISOLATION_CANARY"])
  if (secret) assert(!ordinary.includes(secret), "Credential/canary found in ordinary artifacts");
assert(integration.includes(INTEGRATION_PROJECT), "Missing test project in integration build");
for (const forbidden of [
  "ieytvixchndxnxsxpcot",
  "SMILE_ISOLATION_CANARY",
  config.adminPassword,
  config.userPassword,
])
  if (forbidden)
    assert(
      !integration.includes(forbidden),
      "Production/canary/password found in integration artifacts",
    );
assert(!ordinary.includes(INTEGRATION_PROJECT), "Test backend leaked into ordinary build");
console.log(
  "PASS: integration build uses test project only; passwords excluded; ordinary build unchanged",
);
