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
test("automatic score cannot substitute for confirmed listening", () => {
  const t = track();
  t.listening = { status: "automatic", premiumFit: 5 };
  assert.throws(() => assertPremiumBatch([t]), /прослуховування/);
});
test("rating belongs to exact recording; low scores and rejected legacy tracks fail", () => {
  for (const change of [
    (t) => (t.listening.premiumFit = 3),
    (t) => (t.listening.recordingSha256 = "b".repeat(64)),
    (t) => (t.legacyRejectedByClinic = true),
  ]) {
    const t = track();
    change(t);
    assert.throws(() => assertPremiumBatch([t]));
  }
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
  assert.throws(() => assertPremiumBatch([]), /keep current/);
  const t = track(),
    before = JSON.stringify(t);
  assertPremiumBatch([t]);
  assert.equal(JSON.stringify(t), before);
  assert.throws(() => assertPremiumBatch([t, t]), /Duplicate/);
});
