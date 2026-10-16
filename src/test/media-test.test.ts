import { describe, it, expect, vi, afterEach } from "vitest";
import { localMediaHost, playlist, audioSettings } from "../../scripts/media-test/fixtures";
import { validateAudio } from "@/lib/audio-settings";
import { TvPlayback } from "@/lib/tv-playback";

afterEach(() => vi.restoreAllMocks());
describe("isolated real-media harness", () => {
  it("accepts only loopback/private IPv4 hosts", () => {
    for (const host of [
      "localhost",
      "127.0.0.1",
      "[::1]",
      "192.168.1.10",
      "10.0.0.2",
      "172.16.0.2",
      "172.31.255.1",
    ])
      expect(localMediaHost(host)).toBe(true);
    for (const host of [
      "example.com",
      "smilestream.lovable.app",
      "192.168.1.999",
      "172.32.0.1",
      "8.8.8.8",
      "127.0.0.1.evil.com",
    ])
      expect(localMediaHost(host)).toBe(false);
  });
  it("uses three ordered distinct HTTPS MP4 and separate valid HTTPS MP3 settings", () => {
    expect(playlist).toHaveLength(3);
    expect(new Set(playlist.map((v) => v.url)).size).toBe(3);
    expect(playlist.every((v) => /^https:\/\/.+\.mp4$/.test(v.url) && v.is_test)).toBe(true);
    expect(validateAudio(audioSettings)).toEqual(audioSettings);
    expect(audioSettings.musicUrls[0]).toMatch(/^https:\/\/.+\.mp3$/);
  });
  it("runs the shared engine, preloads, loops and changes levels without reloading music", () => {
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const videos = [document.createElement("video"), document.createElement("video")];
    const music = document.createElement("audio");
    Object.defineProperty(music, "load", { configurable: true, value: vi.fn() });
    const player = new TvPlayback(videos, music, playlist, () => {});
    try {
      player.updateSettings(audioSettings);
      player.start(true);
      const source = music.src;
      const musicLoad = vi.mocked(music.load).mockClear();
      expect(videos[1]!.src).toBe(playlist[1]!.url);
      expect(videos[1]!.preload).toBe("auto");
      for (let i = 0; i < 4; i++) {
        videos[i % 2]!.dispatchEvent(new Event("ended"));
        player.updateSettings({ ...audioSettings, musicVolume: 0.6 });
        videos[1 - (i % 2)]!.dispatchEvent(new Event("playing"));
        expect(music.src).toBe(source);
      }
      expect(videos[0]!.src).toBe(playlist[1]!.url);
      expect(musicLoad).not.toHaveBeenCalled();
    } finally {
      player.dispose();
    }
  });
});
