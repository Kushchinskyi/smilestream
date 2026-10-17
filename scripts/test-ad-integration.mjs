// Actual HTTP clients, not a browser/physical-TV claim. Only the pinned disposable project.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { integrationBackend } from "./integration-target.mjs";
if (process.argv.slice(2).join(" ") !== "--confirm-isolated-project")
  throw new Error("Explicit isolated-project confirmation required");
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
const admin = client(),
  screens = [client(), client()];
const ids = [randomUUID(), randomUUID()],
  videoId = randomUUID();
let previous;
try {
  assert.equal(
    (
      await admin.auth.signInWithPassword({
        email: config.adminEmail,
        password: config.adminPassword,
      })
    ).error,
    null,
  );
  const initial = await admin
    .from("ad_playback_settings")
    .select("enabled,interval_minutes,block_count")
    .eq("id", 1)
    .single();
  assert.equal(initial.error, null);
  previous = initial.data;
  assert.equal(
    (
      await admin.from("advertisements").insert(
        ids.map((id, i) => ({
          id,
          title: `HTTP temporary ad ${i}`,
          url: `https://example.invalid/fixture${i}.mp4`,
          is_active: i === 0,
          original_sound: false,
        })),
      )
    ).error,
    null,
  );
  assert.equal(
    (
      await admin.from("videos").insert({
        id: videoId,
        title: "HTTP temporary playlist fixture",
        url: "https://example.invalid/fixture.mp4",
        is_active: true,
        is_test: true,
        sort_order: 999999,
        duration_seconds: 5,
      })
    ).error,
    null,
  );
  assert.equal(
    (
      await admin
        .from("ad_playback_settings")
        .update({ enabled: true, interval_minutes: 20, block_count: 2 })
        .eq("id", 1)
    ).error,
    null,
  );
  for (const c of screens) {
    const result = await c.rpc("read_ad_playback");
    assert.equal(result.error, null);
    assert.deepEqual(result.data.settings, { enabled: true, interval_minutes: 20, block_count: 2 });
    assert(result.data.advertisements.some((a) => a.id === ids[0]));
    assert(!result.data.advertisements.some((a) => a.id === ids[1]));
    assert(
      (await c.from("videos").select("id").eq("is_active", true)).data.some(
        (v) => v.id === videoId,
      ),
    );
  }
  assert.equal(
    (
      await admin
        .from("advertisements")
        .update({ is_active: true, original_sound: true })
        .eq("id", ids[1])
    ).error,
    null,
  );
  assert.equal(
    (await admin.from("ad_playback_settings").update({ block_count: 0 }).eq("id", 1)).error,
    null,
  );
  for (const c of screens) {
    const result = await c.rpc("read_ad_playback");
    assert.equal(result.error, null);
    assert.equal(result.data.settings.block_count, 0);
    assert.equal(result.data.advertisements.find((a) => a.id === ids[1]).original_sound, true);
  }
  console.log(
    "PASS: two independent anonymous HTTP clients receive admin settings, active ad/sound and playlist changes on next read; no browser render claimed",
  );
} finally {
  let failed = false;
  if (previous && (await admin.from("ad_playback_settings").update(previous).eq("id", 1)).error)
    failed = true;
  if ((await admin.from("advertisements").delete().in("id", ids)).error) failed = true;
  if ((await admin.from("videos").delete().eq("id", videoId)).error) failed = true;
  await admin.auth.signOut({ scope: "local" });
  assert(!failed, "Fixture cleanup/config restore failed; inspect test project before continuing");
  console.log("PASS: only generated HTTP fixtures removed; ad configuration restored");
}
