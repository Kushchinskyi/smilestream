import { describe, expect, it } from "vitest";
import {
  DEFAULT_AUDIO,
  MAX_MUSIC_URLS,
  MAX_ORIGINAL_IDS,
  parseAudio,
  validateAudio,
} from "@/lib/audio-settings";
const id = "00000000-0000-4000-8000-00000000000a";
describe("audio configuration validation", () => {
  it.each([
    "https://",
    "https://example.com:99999/a.mp3",
    "http://example.com/a.mp3",
    "javascript:alert(1)",
    "https://user:secret@example.com/a.mp3",
    "https://exa mple.com/a.mp3",
    "https://example.com/a\nb.mp3",
    "https://example.com/a\\b.mp3",
    "https://example.com/" + "a".repeat(2048),
  ])("rejects invalid music URL %s", (url) => {
    expect(() => validateAudio({ ...DEFAULT_AUDIO, musicUrls: [url] })).toThrow();
    expect(parseAudio({ musicUrls: [url] }).musicUrls).toEqual([]);
  });
  it("accepts valid HTTPS URLs including signed URLs and canonicalizes UUIDs", () => {
    const url = "https://cdn.example.com/audio.mp3?signature=a%2Fb&expires=123";
    expect(
      validateAudio({
        ...DEFAULT_AUDIO,
        musicUrls: [" " + url + " "],
        originalIds: [id.toUpperCase(), id],
      }),
    ).toMatchObject({ musicUrls: [url], originalIds: [id] });
  });
  it.each(["demo-1", "id", "", "00000000-0000-4000-8000-00000000000z"])(
    "rejects invalid original video ID %s",
    (value) => {
      expect(() => validateAudio({ ...DEFAULT_AUDIO, originalIds: [value] })).toThrow();
      expect(parseAudio({ originalIds: [value] }).originalIds).toEqual([]);
    },
  );
  it("enforces database array count limits on writes and bounds tolerant reads", () => {
    const musicUrls = Array(MAX_MUSIC_URLS).fill("https://example.com/a.mp3");
    const originalIds = Array(MAX_ORIGINAL_IDS).fill(id);
    expect(() => validateAudio({ ...DEFAULT_AUDIO, musicUrls, originalIds })).not.toThrow();
    expect(() =>
      validateAudio({ ...DEFAULT_AUDIO, musicUrls: [...musicUrls, musicUrls[0]] }),
    ).toThrow();
    expect(() => validateAudio({ ...DEFAULT_AUDIO, originalIds: [...originalIds, id] })).toThrow();
    expect(parseAudio({ musicUrls: [...musicUrls, musicUrls[0]] }).musicUrls).toHaveLength(
      MAX_MUSIC_URLS,
    );
    expect(parseAudio({ originalIds: [...originalIds, id] }).originalIds).toEqual([id]);
  });
  it.each([
    null,
    [],
    { ...DEFAULT_AUDIO, musicUrls: null },
    { ...DEFAULT_AUDIO, musicVolume: NaN },
    { ...DEFAULT_AUDIO, videoVolume: 2 },
    { ...DEFAULT_AUDIO, duckVolume: -1 },
  ])("rejects malformed imported configuration %#", (value) => {
    expect(() => validateAudio(value)).toThrow();
  });
});
