import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { testBackend, testTarget } from "./test-target.mjs";
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
