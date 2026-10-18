import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { assertPremiumBatch, premiumRejectionReasons } from "./music-premium-gate.mjs";

test("retired initial import command refuses before rewriting live catalog artifacts", () => {
  const paths = ["content/music-profile-plan.json", "public/music-credits.html"];
  const before = paths.map((path) => readFileSync(path, "utf8"));
  const result = spawnSync(process.execPath, ["scripts/prepare-music-catalog.mjs"], {
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Legacy catalog generation retired/);
  assert.deepEqual(
    paths.map((path) => readFileSync(path, "utf8")),
    before,
  );
});
const track = () => ({
  id: "fixture",
  url: "https://example.org/music.mp3",
  styleAudit: { status: "metadata_fit", evidence: ["fixture-source-metadata"] },
  listening: {
    status: "confirmed",
    premiumFit: 4,
    reviewer: "Test reviewer",
    reviewedAt: "2026-10-18",
    recordingSha256: "a".repeat(64),
    notes: "Fixture only",
  },
  replacementRights: {
    status: "cleared",
    composition: true,
    recording: true,
    commercialClinicUkraine: true,
    publicMp3Hosting: true,
    evidence: ["fixture-permission"],
    checkedAt: "2026-10-18",
  },
  technical: {
    sha256: "a".repeat(64),
    decoded: true,
    codec: { codec_name: "mp3", channels: 2 },
    durationSeconds: 180,
    integratedLufs: -18,
    truePeakDbfs: -2,
    browserPlaybackConfirmed: true,
  },
});
test("needs-listening does not block technically and legally admitted metadata-fit tracks", () => {
  const t = track();
  t.listening = { status: "needs_listening", premiumFit: null };
  assertPremiumBatch([t]);
  assert.equal(t.listening.premiumFit, null);
});
test("missing metadata assessment and rejected legacy recordings fail", () => {
  for (const change of [
    (t) => (t.styleAudit.status = "not_audited"),
    (t) => (t.styleAudit.evidence = []),
    (t) => (t.legacyRejectedByClinic = true),
  ]) {
    const t = track();
    change(t);
    assert.throws(() => assertPremiumBatch([t]));
  }
});
test("renaming or rehosting a retired recording cannot bypass its byte hash exclusion", () => {
  const retired = JSON.parse(
    readFileSync(new URL("../content/music-retired-recordings.json", import.meta.url), "utf8"),
  );
  const t = track();
  t.technical.sha256 = retired.recordings[0].sha256;
  t.url = "https://example.org/renamed.mp3";
  assert.throws(() => assertPremiumBatch([t]), /previous selection/);
});
test("hosting, clinic rights and actual technical checks are independently required", () => {
  for (const change of [
    (t) => (t.replacementRights.publicMp3Hosting = false),
    (t) => (t.replacementRights.commercialClinicUkraine = false),
    (t) => (t.technical.browserPlaybackConfirmed = false),
    (t) => (t.technical.integratedLufs = null),
  ]) {
    const t = track();
    change(t);
    assert(premiumRejectionReasons(t).length);
  }
});
test("empty replacement and duplicates fail; audit is pure", () => {
  assert.throws(() => assertPremiumBatch([]), /without background/);
  const t = track(),
    before = JSON.stringify(t);
  assertPremiumBatch([t]);
  assert.equal(JSON.stringify(t), before);
  assert.throws(() => assertPremiumBatch([t, t]), /Duplicate/);
});
