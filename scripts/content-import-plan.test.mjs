import { test } from "node:test";
import assert from "node:assert/strict";
import { preparePlan } from "./content-import-plan.mjs";
const candidate = {
  title: "Dental process",
  url: "https://videos.pexels.com/video-files/123/123-hd.mp4",
  sourceUrl: "https://www.pexels.com/video/process-123/",
  licenseUrl: "https://www.pexels.com/license/",
  durationSeconds: 12.5,
  category: "digital",
  originalSound: false,
  commercialLicenseConfirmed: true,
  technicalStatus: "hd-h264-aac-or-silent",
  visualReviewApproved: true,
  hostingApproved: true,
};
test("append only, disabled, whitelist; leaves original order and secrets untouched", () => {
  const old = [{ url: "https://example.com/old.mp4", sort_order: 7 }],
    before = structuredClone(old);
  const p = preparePlan([{ ...candidate, token: "do-not-export" }], old);
  assert.deepEqual(old, before);
  assert.equal(p.executable, false);
  assert.equal(p.additions[0].sort_order, 8);
  assert.equal(p.additions[0].is_active, false);
  assert.equal(p.additions[0].duration_seconds, 13);
  assert(!JSON.stringify(p).includes("do-not-export"));
});
test("detects Pexels variants, Mixkit variants and duplicates within batch", () => {
  assert.equal(
    preparePlan(
      [candidate],
      [{ url: "https://videos.pexels.com/video-files/123/123-4k.mp4", sort_order: 1 }],
    ).additions.length,
    0,
  );
  assert.equal(preparePlan([candidate, candidate], []).held.length, 1);
  assert.equal(
    preparePlan(
      [{ ...candidate, url: "https://assets.mixkit.co/videos/12/12-1080.mp4" }],
      [{ url: "https://assets.mixkit.co/videos/12/12-720.mp4", sort_order: 1 }],
    ).held.length,
    1,
  );
});
test("rejects credentials, HTTP, temporary signed links and malformed fields", () => {
  for (const url of [
    "http://example.com/a.mp4",
    "https://user:pass@example.com/a.mp4",
    "https://example.com/a.mp4?expires=1",
    "https://example.com/\\evil",
  ])
    assert.equal(preparePlan([{ ...candidate, url }], []).additions.length, 0);
  for (const change of [
    { durationSeconds: NaN },
    { category: "unknown" },
    { title: "" },
    { originalSound: undefined },
  ])
    assert.equal(preparePlan([{ ...candidate, ...change }], []).additions.length, 0);
});
test("holds incomplete licenses, codecs, visual review, hosting and original audio", () => {
  for (const change of [
    { commercialLicenseConfirmed: false },
    { technicalStatus: "needs-normalization" },
    { visualReviewApproved: false },
    { hostingApproved: false },
    { originalSound: true },
  ])
    assert.equal(preparePlan([{ ...candidate, ...change }], []).additions.length, 0);
});
test("fails closed for invalid snapshots and capacity, never replaces settings", () => {
  assert.throws(() => preparePlan([], [{ url: "bad", sort_order: 1 }]));
  assert.throws(() => preparePlan(Array(501).fill(candidate), []));
  assert.throws(() =>
    preparePlan([candidate], [{ url: "https://example.com/old.mp4", sort_order: 1000000 }]),
  );
  assert(!("musicUrls" in preparePlan([], [])));
});
