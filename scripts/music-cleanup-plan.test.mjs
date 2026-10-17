import { test } from "node:test";
import assert from "node:assert/strict";
import { musicCleanupSql } from "./music-cleanup-plan.mjs";
const prefix =
  "https://ieytvixchndxnxsxpcot.supabase.co/storage/v1/object/public/smilestream-music/";
const fixture = () => {
  const objects = Array.from({ length: 59 }, (_, i) => ({
    name: i.toString(16).padStart(16, "0") + ".mp3",
  }));
  const urls = objects.map((o) => prefix + o.name);
  return {
    audio: { id: 1, music_urls: urls, music_volume: 0.35, duck_volume: 0.15 },
    profiles: Array.from({ length: 7 }, (_, i) => ({ id: `fixture-${i}`, track_urls: urls })),
    metadata: urls.map((source_key) => ({ kind: "music", source_key })),
    objects,
    other_references: null,
    protected: { video_count: 25 },
  };
};
test("cleanup SQL preserves parameters, verifies snapshots and removes only inspected music metadata", () => {
  const snapshot = fixture(),
    before = JSON.stringify(snapshot),
    sql = musicCleanupSql(snapshot);
  assert.equal(JSON.stringify(snapshot), before);
  assert.match(sql, /Snapshot changed/);
  assert.match(sql, /Cleanup postcondition failed/);
  assert.match(sql, /delete from public.media_metadata where kind='music' and source_key in/);
  assert.doesNotMatch(
    sql,
    /delete from (?:storage|auth)|update public\.(?:videos|screens|user_roles|advertisements)/i,
  );
});
test("unexpected files, dependencies or incomplete inventory refuse SQL generation", () => {
  for (const change of [
    (s) => s.objects.push({ name: "unrelated.mp4" }),
    (s) => (s.other_references = [{ tbl: "videos" }]),
    (s) => s.audio.music_urls.pop(),
    (s) => (s.metadata[0].kind = "video"),
    (s) => s.profiles[0].track_urls.push("https://example.org/new.mp3"),
  ]) {
    const s = fixture();
    change(s);
    assert.throws(() => musicCleanupSql(s));
  }
});
