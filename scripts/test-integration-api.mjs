// Real Data API/Auth checks, restricted to the explicitly approved disposable project.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { integrationBackend } from "./integration-target.mjs";
if (process.argv.slice(2).join(" ") !== "--confirm-isolated-project")
  throw new Error("Pass --confirm-isolated-project to test ONLY the approved integration database");
const config = JSON.parse(
  (await readFile(new URL("../smile-integration.local", import.meta.url), "utf8")).replace(
    /^\uFEFF/,
    "",
  ),
);
const backend = integrationBackend(config);
function client() {
  return createClient(backend.endpoint, backend.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(12000) }),
    },
  });
}
const anon = client(),
  user = client(),
  admin = client();
try {
  assert.equal(
    (await user.auth.signInWithPassword({ email: config.userEmail, password: config.userPassword }))
      .error,
    null,
  );
  assert.equal(
    (
      await admin.auth.signInWithPassword({
        email: config.adminEmail,
        password: config.adminPassword,
      })
    ).error,
    null,
  );
  for (const [name, c] of [
    ["anon", anon],
    ["ordinary user", user],
    ["admin", admin],
  ]) {
    const read = await c.from("playback_settings").select("*").eq("id", 1).single();
    assert.equal(read.error, null);
    assert.equal(read.data.id, 1);
    assert((await c.from("videos").select("id").eq("is_active", true)).data.length >= 1);
    assert(
      (await c.from("playback_settings").insert({ id: 1 })).error,
      `${name}: INSERT must be denied`,
    );
    assert(
      (await c.from("playback_settings").delete().eq("id", 1)).error,
      `${name}: DELETE must be denied`,
    );
    if (name === "anon")
      assert((await c.from("playback_settings").update({ music_volume: 0.99 }).eq("id", 1)).error);
    if (name === "ordinary user") {
      const write = await c
        .from("playback_settings")
        .update({ music_volume: 0.99 })
        .eq("id", 1)
        .select("id");
      assert.equal(write.error, null);
      assert.deepEqual(write.data, []);
      const roles = await c.from("user_roles").select("role");
      assert.equal(roles.error, null);
      assert.deepEqual(roles.data, []);
    }
    console.log(`PASS: ${name} read + INSERT/DELETE/write restrictions`);
  }
  const before = (await admin.from("playback_settings").select("music_volume").eq("id", 1).single())
    .data;
  const allowed = await admin
    .from("playback_settings")
    .update({ music_volume: before.music_volume })
    .eq("id", 1)
    .select("id")
    .single();
  assert.equal(allowed.error, null);
  assert.equal(allowed.data.id, 1);
  for (const invalid of [
    { music_volume: 1.01 },
    { video_volume: -1 },
    { duck_volume: null },
    { original_video_ids: ["bad-id"] },
    { music_urls: Array(501).fill("https://example.invalid/a.mp3") },
  ])
    assert(
      (await admin.from("playback_settings").update(invalid).eq("id", 1)).error,
      "invalid value accepted",
    );
  assert((await admin.from("playback_settings").update({ id: 2 }).eq("id", 1)).error);
  assert.equal(
    (await anon.from("playback_settings").select("music_volume").eq("id", 1).single()).data
      .music_volume,
    before.music_volume,
  );
  console.log(
    "PASS: authenticated admin UPDATE RETURNING; invalid values/id updates rejected; settings unchanged",
  );
  for (const [name, c] of [
    ["anon", anon],
    ["ordinary", user],
    ["admin", admin],
  ]) {
    const metadata = await c.from("media_metadata").select("*").limit(1);
    if (name === "anon") assert(metadata.error);
    else {
      assert.equal(metadata.error, null);
      if (name === "ordinary") assert.deepEqual(metadata.data, []);
    }
    const invalidOrder = await c.rpc("reorder_videos", { ordered_ids: [] });
    assert(invalidOrder.error, `${name}: invalid reorder must be rejected`);
  }
  console.log("PASS: metadata access and invalid reorder denied through real Data API");
  for (const [name, c] of [
    ["anon", anon],
    ["ordinary", user],
    ["admin", admin],
  ]) {
    const inventory = await c.from("advertisements").select("id,is_active").limit(10);
    assert.equal(inventory.error, null);
    if (name !== "admin") assert(inventory.data.every((row) => row.is_active));
    const settings = await c.from("ad_playback_settings").select("*").eq("id", 1).single();
    assert.equal(settings.error, null);
    const snapshot = await c.rpc("read_ad_playback");
    assert.equal(snapshot.error, null);
    assert(snapshot.data.advertisements.every((row) => row.is_active));
    assert((await c.from("ad_playback_settings").insert({ id: 1 })).error);
    assert((await c.from("ad_playback_settings").delete().eq("id", 1)).error);
    const write = await c
      .from("ad_playback_settings")
      .update({ enabled: settings.data.enabled })
      .eq("id", 1)
      .select("id");
    if (name === "anon") assert(write.error);
    else {
      assert.equal(write.error, null);
      assert.equal(write.data.length, name === "admin" ? 1 : 0);
    }
    if (name === "admin") {
      for (const value of [
        { interval_minutes: 1 },
        { block_count: 4 },
        { enabled: null },
        { id: 2 },
      ])
        assert((await c.from("ad_playback_settings").update(value).eq("id", 1)).error);
    }
    assert((await c.rpc("reorder_advertisements", { ordered_ids: null })).error);
  }
  console.log(
    "PASS: ad settings, invoker snapshot, active-only public read, role writes, constraints and null reorder guard",
  );
} finally {
  await Promise.all([
    user.auth.signOut({ scope: "local" }),
    admin.auth.signOut({ scope: "local" }),
  ]);
}
