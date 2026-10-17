import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { admitted, prepareMusicCatalog, musicImportSql } from "./music-catalog-plan.mjs";

const registry = JSON.parse(
  readFileSync(new URL("../content/music-registry.json", import.meta.url)),
);
const evidence = new Set(registry.evidence.map((item) => item.id));
const verified = registry.tracks.find((track) => track.status === "verified");
test("only decoded MP3 with primary rights evidence and attribution enters a plan", () => {
  assert.equal(admitted(verified, evidence), true);
  for (const status of ["legal_review", "rejected", "unavailable"]) {
    assert.equal(admitted({ ...verified, status }, evidence), false);
  }
  assert.equal(Boolean(admitted({ ...verified, rights: {} }, evidence)), false);
  assert.equal(Boolean(admitted({ ...verified, attribution: null }, evidence)), false);
  assert.equal(
    admitted({ ...verified, url: "https://user:password@example.org/a.mp3" }, evidence),
    false,
  );
  assert.equal(admitted({ ...verified, url: "http://example.org/a.mp3" }, evidence), false);
  assert.equal(
    admitted({ ...verified, technical: { ...verified.technical, decoded: false } }, evidence),
    false,
  );
  assert.equal(Boolean(admitted(verified, new Set())), false);
});
test("seven deterministic profiles, no repeats or invented audio; automix reuses cleared main tracks", () => {
  const before = JSON.stringify(registry);
  const plan = prepareMusicCatalog(registry);
  assert.equal(JSON.stringify(registry), before);
  assert.deepEqual(prepareMusicCatalog(registry), plan);
  assert.equal(plan.profiles.length, 7);
  assert.equal(plan.profiles.filter((profile) => profile.is_default).length, 1);
  const main = plan.profiles.slice(0, 6).flatMap((profile) => profile.track_urls);
  assert.equal(new Set(main).size, main.length);
  assert.equal(plan.profiles[6].track_urls.length, 50);
  for (const profile of plan.profiles) {
    assert.equal(new Set(profile.track_urls).size, profile.track_urls.length);
    assert(profile.track_urls.length <= 50);
    assert(profile.track_urls.every((url) => main.includes(url)));
    assert.equal(profile.volume_override, null);
  }
  assert(!plan.profiles.some((profile) => profile.name === "Без музики"));
});
test("duplicate recordings and falsely verified candidates fail closed", () => {
  assert.throws(
    () => prepareMusicCatalog({ ...registry, tracks: [...registry.tracks, verified] }),
    /Duplicate/,
  );
  const other = {
    ...verified,
    id: "duplicate",
    url: "https://example.org/a.mp3",
    technical: {
      ...verified.technical,
      http: { ...verified.technical.http, url: "https://example.org/a.mp3" },
    },
  };
  assert.throws(
    () => prepareMusicCatalog({ ...registry, tracks: [...registry.tracks, other] }),
    /Duplicate recording/,
  );
  const candidate = registry.tracks.find((track) => track.status === "legal_review");
  assert.throws(
    () =>
      prepareMusicCatalog({
        ...registry,
        tracks: [...registry.tracks, { ...candidate, status: "verified" }],
      }),
    /lacks rights/,
  );
});
test("SQL is manual, guarded, append-only, without auth/schema/video/ad updates", () => {
  const plan = prepareMusicCatalog(registry);
  assert.throws(() => musicImportSql(plan), /fingerprints/);
  const sql = musicImportSql(plan, {
    videoFingerprint: "a".repeat(32),
    rolesFingerprint: "b".repeat(32),
    audio: { id: 1, music_urls: [] },
    adSettings: [],
  });
  assert.match(sql, /set music_urls=music_urls \|\| urls/);
  assert.match(sql, /Library\/profiles\/advertisements changed/);
  assert.match(sql, /Protected audio settings changed/);
  assert.doesNotMatch(sql, /\b(delete|drop|alter|truncate|grant|revoke)\b/i);
  assert.doesNotMatch(sql, /update\s+(public\.)?(videos|screens|advertisements|user_roles)/i);
  assert.doesNotMatch(sql, /service_role|secret|password/i);
  assert.equal(sql.includes("Suno"), false);
});
test("all registry records carry explicit status and never equate untested audio with verified", () => {
  for (const track of registry.tracks) {
    assert(["verified", "legal_review", "rejected", "unavailable"].includes(track.status));
    for (const key of [
      "title",
      "artist",
      "sourceUrl",
      "license",
      "licenseUrl",
      "checkedAt",
      "reason",
      "technical",
      "rights",
    ])
      assert(track[key], `${track.id}: ${key}`);
    if (track.status === "verified") assert(admitted(track, evidence));
    assert.equal(track.curation.humanFullListen, false);
  }
});
test("public attribution contains every admitted title/source/license and no pending catalog", () => {
  const html = readFileSync(new URL("../public/music-credits.html", import.meta.url), "utf8");
  for (const track of prepareMusicCatalog(registry).tracks) {
    assert(html.includes(track.title.replaceAll("&", "&amp;").replaceAll('"', "&quot;")));
    assert(html.includes(track.sourceUrl));
    assert(html.includes(track.licenseUrl));
  }
  assert(!html.includes("Suno"));
  assert(!html.includes("Kevin MacLeod"));
  assert(!html.includes("<audio"));
  assert(!html.includes("<script"));
  assert.match(html, /href="\/tv"/);
});
