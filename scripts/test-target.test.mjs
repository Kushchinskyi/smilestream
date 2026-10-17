import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { testBackend, testTarget } from "./test-target.mjs";
import { mediaTestEnvironment, assertMediaTestBuild } from "./media-test/guard.mjs";
import { integrationBackend, INTEGRATION_PROJECT } from "./integration-target.mjs";
test("accelerated ad clock has no normal environment/query switch", () => {
  const normal = readFileSync(new URL("../src/lib/ad-clock.ts", import.meta.url), "utf8");
  assert.match(normal, /integrationAdIntervalMs = 0/);
  assert(!/import\.meta\.env|process\.env|location|URLSearchParams/.test(normal));
  const special = readFileSync(new URL("../vite.integration.config.mjs", import.meta.url), "utf8");
  assert.match(special, /env\.mode !== "integration-test"/);
  assert.match(special, /process\.env\.SMILE_INTEGRATION_PROJECT !== INTEGRATION_PROJECT/);
  assert.match(special, /integration-ad-clock\.ts/);
  const production = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
  assert(!production.includes("integration-ad-clock"));
});
test("integration launcher is pinned to the approved isolated project", () => {
  const config = {
    projectRef: INTEGRATION_PROJECT,
    url: `https://${INTEGRATION_PROJECT}.supabase.co`,
    publishableKey: "sb_publishable_test",
  };
  assert.equal(integrationBackend(config).endpoint, config.url);
  for (const url of [
    "https://ieytvixchndxnxsxpcot.supabase.co",
    "https://other.supabase.co",
    "http://127.0.0.1",
    `${config.url}/path`,
  ])
    assert.throws(() => integrationBackend({ ...config, url }), /approved isolated/);
  assert.throws(() => integrationBackend({ ...config, projectRef: "other" }), /approved isolated/);
  assert.throws(
    () => integrationBackend({ ...config, publishableKey: "sb_secret_forbidden" }),
    /publishable/,
  );
});
test("media preview removes inherited backend, Vite and test credentials", () => {
  const clean = mediaTestEnvironment(
    {
      PATH: "keep",
      VITE_SUPABASE_URL: "production",
      SUPABASE_SERVICE_ROLE_KEY: "secret",
      SMILE_TEST_DATABASE_URL: "secret",
      VITE_OTHER_TOKEN: "secret",
      NITRO_PRESET: "cloudflare",
    },
    [],
  );
  assert.equal(clean.PATH, "keep");
  assert.equal(clean.NITRO_PRESET, "node-server");
  assert.equal(JSON.stringify(clean).includes("secret"), false);
  assert.equal(clean.VITE_SUPABASE_URL, undefined);
  assert.throws(() => mediaTestEnvironment({}, ["--staging"]), /staging/);
});
test("media build cannot run in normal mode, without launcher, or in hosting/CI", () => {
  assert.throws(() => assertMediaTestBuild({}, "media-test"), /launcher/);
  const env = mediaTestEnvironment({}, []);
  assert.throws(() => assertMediaTestBuild(env, "production"), /normal builds/);
  assert.doesNotThrow(() => assertMediaTestBuild(env, "media-test"));
  for (const key of [
    "CI",
    "LOVABLE_PREVIEW_HOST",
    "LOVABLE_NITRO_PRESET",
    "CF_PAGES",
    "VERCEL",
    "NETLIFY",
  ])
    assert.throws(
      () => assertMediaTestBuild({ ...env, [key]: "1" }, "media-test"),
      /local preview/,
    );
});
test("launcher refuses media-test with staging before spawning a build/server", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/start-local-test.mjs", "--media-test", "--staging"],
    {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      encoding: "utf8",
    },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /media-test cannot use staging/);
  assert(!result.stdout.includes("Local test only"));
});
test("default local launch ignores production environment and disables backend", () => {
  assert.deepEqual(
    testBackend({
      VITE_SUPABASE_URL: "https://production.invalid",
      SUPABASE_URL: "https://production.invalid",
      VITE_SUPABASE_PUBLISHABLE_KEY: "ignored",
    }),
    { endpoint: "", key: "" },
  );
});
test("remote targets require explicit staging flag", () => {
  assert.throws(() => testTarget("https://staging.example.com"), /staging/);
  assert.equal(testTarget("https://staging.example.com", { staging: true }).local, false);
  assert.equal(testTarget("http://127.0.0.1:54321").local, true);
});
test("known production project is refused even with staging flag", () => {
  for (const url of [
    "https://ieytvixchndxnxsxpcot.supabase.co",
    "postgres://postgres.ieytvixchndxnxsxpcot:fake@pooler.example.com/postgres",
    "postgres://postgres.%69eytvixchndxnxsxpcot:fake@pooler.example.com/postgres",
  ]) {
    assert.throws(() => testTarget(url, { staging: true }), /Production/);
  }
});
test("explicit local browser settings accept only public keys", () => {
  const env = {
    SMILE_TEST_SUPABASE_URL: "http://127.0.0.1:54321",
    SMILE_TEST_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_placeholder",
  };
  assert.equal(testBackend(env).endpoint, env.SMILE_TEST_SUPABASE_URL);
  assert.throws(() =>
    testBackend({ ...env, SMILE_TEST_SUPABASE_PUBLISHABLE_KEY: "sb_secret_fake" }),
  );
  const jwt = (role) =>
    "header." + Buffer.from(JSON.stringify({ role })).toString("base64url") + ".signature";
  assert.throws(() =>
    testBackend({ ...env, SMILE_TEST_SUPABASE_PUBLISHABLE_KEY: jwt("service_role") }),
  );
  assert.equal(
    testBackend({ ...env, SMILE_TEST_SUPABASE_PUBLISHABLE_KEY: jwt("anon") }).key,
    jwt("anon"),
  );
  assert.throws(() => testBackend({ SMILE_TEST_SUPABASE_URL: env.SMILE_TEST_SUPABASE_URL }));
});
test("SQL runner fails before connecting without explicit isolated-test confirmation", () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./test-sql.mjs", import.meta.url))],
    {
      encoding: "utf8",
      env: { ...process.env, SMILE_SQL_TEST_CONFIRM: "", SMILE_TEST_DATABASE_URL: "" },
    },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /SMILE_SQL_TEST_CONFIRM/);
});
test("SQL runner refuses a production URL even with staging and confirmation", () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./test-sql.mjs", import.meta.url)), "--staging"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        SMILE_SQL_TEST_CONFIRM: "isolated-test",
        SMILE_TEST_DATABASE_URL:
          "postgres://postgres:fake@ieytvixchndxnxsxpcot.supabase.co/postgres",
      },
    },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Production project is forbidden/);
});
