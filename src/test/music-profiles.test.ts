import { describe, it, expect, beforeEach } from "vitest";
import { DEFAULT_AUDIO } from "@/lib/audio-settings";
import {
  NO_MUSIC,
  LEGACY_MUSIC,
  PROFILE_KEY,
  profileAudio,
  resolveProfile,
  validateProfile,
  readProfileChoice,
  rememberProfileChoice,
  type MusicProfile,
} from "@/lib/music-profiles";
const a: MusicProfile = {
  id: "b1000000-0000-4000-8000-000000000001",
  name: "Piano",
  description: "Quiet",
  is_active: true,
  is_default: true,
  sort_order: 1,
  volume_override: 0.2,
  track_urls: ["https://example.com/a.mp3", "https://example.com/b.mp3"],
};
const b: MusicProfile = {
  ...a,
  id: "b1000000-0000-4000-8000-000000000002",
  name: "Ambient",
  is_default: false,
  volume_override: null,
  sort_order: 2,
};
const base = {
  ...DEFAULT_AUDIO,
  musicUrls: [...a.track_urls],
  originalIds: ["b1000000-0000-4000-8000-000000000003"],
};
beforeEach(() => localStorage.clear());
describe("music profiles", () => {
  it("one/default and multiple profiles resolve deterministically", () => {
    expect(resolveProfile([a], null)).toBe(a.id);
    expect(resolveProfile([a, b], b.id)).toBe(b.id);
    expect(resolveProfile([b, a], null)).toBe(a.id);
  });
  it("deleted and inactive choices fall back without affecting video/audio flags", () => {
    expect(resolveProfile([], b.id)).toBe(NO_MUSIC);
    expect(resolveProfile([a], b.id)).toBe(a.id);
    expect(resolveProfile([a, { ...b, is_active: false }], b.id)).toBe(a.id);
    expect(profileAudio(base, [a], a.id)).toMatchObject({
      videoVolume: 1,
      duckVolume: 0.15,
      originalIds: base.originalIds,
      musicVolume: 0.2,
    });
  });
  it("no music remains silent even after new default appears", () => {
    expect(profileAudio(base, [a, b], NO_MUSIC).musicUrls).toEqual([]);
    expect(resolveProfile([], NO_MUSIC)).toBe(NO_MUSIC);
  });
  it("empty profiles and removed library tracks are silent, not legacy fallbacks", () => {
    expect(profileAudio(base, [{ ...a, track_urls: [] }], a.id).musicUrls).toEqual([]);
    expect(profileAudio({ ...base, musicUrls: [] }, [a], a.id).musicUrls).toEqual([]);
  });
  it("preserves ordered references and legacy library when no profiles exist", () => {
    expect(
      profileAudio(base, [{ ...a, track_urls: [...a.track_urls].reverse() }], a.id).musicUrls,
    ).toEqual([...a.track_urls].reverse());
    expect(resolveProfile([], null)).toBe(LEGACY_MUSIC);
    expect(profileAudio(base, [], null)).toEqual(base);
  });
  it("persists only a local screen choice and rejects corrupted storage", () => {
    rememberProfileChoice(b.id);
    expect(readProfileChoice()).toBe(b.id);
    rememberProfileChoice(NO_MUSIC);
    expect(readProfileChoice()).toBe(NO_MUSIC);
    localStorage.setItem(PROFILE_KEY, "corrupt");
    expect(readProfileChoice()).toBeNull();
  });
  it("rejects unsafe URLs, duplicates, invalid volume and inactive default", () => {
    for (const change of [
      { volume_override: NaN },
      { volume_override: 2 },
      { is_active: false },
      { track_urls: ["http://x/a.mp3"] },
      { track_urls: [a.track_urls[0]!, a.track_urls[0]!] },
      { name: "" },
    ])
      expect(() => validateProfile({ ...a, ...change })).toThrow();
  });
});
