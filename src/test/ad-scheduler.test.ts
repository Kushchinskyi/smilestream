import { describe, it, expect } from "vitest";
import {
  AdScheduler,
  DEFAULT_ADS,
  validateAdSettings,
  type Advertisement,
} from "@/lib/ad-scheduler";
const ads: Advertisement[] = [1, 2, 3].map((n) => ({
  id: String(n),
  title: `Ad ${n}`,
  url: `https://example.com/${n}.mp4`,
  duration_seconds: 5,
  sort_order: n,
  is_active: true,
  is_test: true,
  original_sound: false,
}));
function due(s: AdScheduler) {
  for (let i = 0; i < 12; i++) s.tick(5000, true);
}
function configured(count = 1) {
  const s = new AdScheduler(60000);
  s.update({
    settings: { ...DEFAULT_ADS, enabled: true, block_count: count },
    advertisements: ads,
  });
  return s;
}
describe("one per-TV advertisement scheduler", () => {
  it("uses the saved fifteen-minute interval in an ordinary build", () => {
    const s = new AdScheduler();
    s.update({
      settings: { ...DEFAULT_ADS, enabled: true, interval_minutes: 15 },
      advertisements: ads,
    });
    for (let i = 0; i < 179; i++) s.tick(5000, true);
    expect(s.takeBlock()).toEqual([]);
    s.tick(5000, true);
    expect(s.takeBlock()).toHaveLength(1);
  });
  it("rejects oversized snapshots without truncating all-ad selection", () => {
    const s = configured();
    expect(() =>
      s.update({
        settings: { ...DEFAULT_ADS, enabled: true, block_count: 0 },
        advertisements: Array(1001).fill(ads[0]!),
      }),
    ).toThrow(/1000/);
    due(s);
    expect(s.takeBlock()).toHaveLength(1);
  });
  it("waits for due time and rotates bounded blocks without duplicate consumption", () => {
    const s = configured(2);
    expect(s.takeBlock()).toEqual([]);
    due(s);
    expect(s.takeBlock().map((a) => a.id)).toEqual(["1", "2"]);
    expect(s.takeBlock()).toEqual([]);
    due(s);
    expect(s.takeBlock()).toEqual([]);
    s.finish();
    due(s);
    expect(s.takeBlock().map((a) => a.id)).toEqual(["3", "1"]);
  });
  it("supports all, one, inactive and empty advertisements", () => {
    for (const count of [0, 1, 2, 3]) {
      const s = configured(count);
      due(s);
      expect(s.takeBlock()).toHaveLength(count || 3);
    }
    const s = configured();
    s.update({
      settings: { ...DEFAULT_ADS, enabled: true },
      advertisements: [{ ...ads[0]!, is_active: false }],
    });
    due(s);
    expect(s.takeBlock()).toEqual([]);
    s.update({ settings: { ...DEFAULT_ADS, enabled: true }, advertisements: [ads[2]!] });
    due(s);
    expect(s.takeBlock()[0]?.id).toBe("3");
  });
  it("resets debt on pause/offline/hidden and settings changes but not identical polling", () => {
    const s = configured();
    due(s);
    s.tick(0, false);
    expect(s.takeBlock()).toEqual([]);
    due(s);
    s.update({ settings: { ...DEFAULT_ADS, enabled: true }, advertisements: ads });
    expect(s.takeBlock()).toHaveLength(1);
    s.finish();
    due(s);
    s.update({
      settings: { ...DEFAULT_ADS, enabled: true, interval_minutes: 45 },
      advertisements: ads,
    });
    expect(s.takeBlock()).toEqual([]);
    due(s);
    s.update({ settings: DEFAULT_ADS, advertisements: ads });
    expect(s.takeBlock()).toEqual([]);
  });
  it("never catches up after a suspended clock or restart", () => {
    const s = configured();
    s.tick(8 * 3600000, true);
    expect(s.takeBlock()).toEqual([]);
    expect(configured().takeBlock()).toEqual([]);
  });
  it("rotates deterministically through list changes and 100 cycles", () => {
    const s = configured();
    for (let i = 0; i < 100; i++) {
      due(s);
      expect(s.takeBlock()[0]?.id).toBe(String((i % 3) + 1));
      s.finish();
    }
    s.update({ settings: { ...DEFAULT_ADS, enabled: true }, advertisements: [ads[1]!, ads[2]!] });
    due(s);
    expect(s.takeBlock()[0]?.id).toBe("2");
  });
  it("rejects accelerated intervals and invalid counts in ordinary settings", () => {
    for (const interval_minutes of [1, 2, 0, NaN, Infinity])
      expect(() => validateAdSettings({ ...DEFAULT_ADS, interval_minutes })).toThrow();
    expect(() => validateAdSettings({ ...DEFAULT_ADS, block_count: 4 })).toThrow();
  });
});
