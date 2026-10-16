import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TvPlayback } from "@/lib/tv-playback";
import { parseAudio } from "@/lib/audio-settings";
import { DEMO_PLAYLIST } from "@/lib/backend";
const TEST_PLAYLIST = DEMO_PLAYLIST.map((v, i) => ({
  ...v,
  id: `00000000-0000-4000-8000-00000000000${i + 1}`,
}));

describe("TV media channels", () => {
  let videos: HTMLVideoElement[], music: HTMLAudioElement, player: TvPlayback;
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      Object.defineProperty(this, "paused", { value: true, configurable: true });
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      Object.defineProperty(this, "paused", { value: false, configurable: true });
      return Promise.resolve();
    });
    videos = [document.createElement("video"), document.createElement("video")];
    music = document.createElement("audio");
    Object.defineProperty(music, "load", { value: vi.fn(), configurable: true });
    Object.defineProperty(music, "play", {
      value: vi.fn(() => {
        Object.defineProperty(music, "paused", { value: false, configurable: true });
        return Promise.resolve();
      }),
      configurable: true,
    });
    player = new TvPlayback(videos, music, TEST_PLAYLIST, vi.fn());
    player.updateSettings({
      musicUrls: ["https://example.com/music.mp3"],
      musicVolume: 0.5,
      videoVolume: 0.8,
      duckVolume: 0.2,
      originalIds: [TEST_PLAYLIST[0]!.id],
    });
  });
  afterEach(() => {
    player.dispose();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  it("preloads next, retains outgoing until playing, and keeps music independent", () => {
    player.start(true);
    videos[0]!.dispatchEvent(new Event("playing"));
    expect(videos[1]!.getAttribute("src")).toBe(TEST_PLAYLIST[1]!.url);
    expect(music.volume).toBeCloseTo(0.1);
    expect(videos[0]!.volume).toBe(0.8);
    const src = music.src;
    const musicLoad = vi.mocked(music.load).mockClear();
    const musicPlay = vi.mocked(music.play).mockClear();
    videos[0]!.dispatchEvent(new Event("ended"));
    expect(videos[0]!.muted).toBe(false);
    expect(videos[1]!.muted).toBe(true);
    videos[1]!.dispatchEvent(new Event("playing"));
    expect(videos[0]!.muted).toBe(true);
    expect(videos[1]!.style.zIndex).toBe("1");
    expect(music.src).toBe(src);
    expect(music.volume).toBe(0.5);
    expect(musicLoad).not.toHaveBeenCalled();
    expect(musicPlay).not.toHaveBeenCalled();
    videos[1]!.dispatchEvent(new Event("ended"));
    videos[0]!.dispatchEvent(new Event("playing"));
    expect(videos[0]!.getAttribute("src")).toBe(TEST_PLAYLIST[0]!.url);
    expect(videos[0]!.muted).toBe(false);
  });
  it("recovers frozen media and releases timers on disposal", () => {
    const load = vi.spyOn(videos[0]!, "load");
    player.start(true);
    vi.advanceTimersByTime(24000);
    expect(load.mock.calls.length).toBeGreaterThan(1);
    player.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("retries network errors then skips the failing video", () => {
    player.start(true);
    for (const delay of [2000, 4000, 8000]) {
      videos[0]!.dispatchEvent(new Event("error"));
      vi.advanceTimersByTime(delay);
    }
    videos[1]!.dispatchEvent(new Event("playing"));
    expect(videos[1]!.style.zIndex).toBe("1");
    expect(videos[0]!.muted).toBe(true);
  });
  it("pauses both channels on autoplay rejection and permits gesture retry", async () => {
    vi.spyOn(videos[0]!, "play").mockRejectedValueOnce({ name: "NotAllowedError" });
    player.start(true);
    await Promise.resolve();
    expect(music.paused).toBe(true);
    expect(videos[0]!.paused).toBe(true);
    player.start(true);
    expect(videos[0]!.paused).toBe(false);
    expect(music.paused).toBe(false);
  });
  it("applies settings without restarting video and sanitizes malformed settings", () => {
    player.start(true);
    player.updateSettings({
      musicUrls: [],
      musicVolume: 0.2,
      videoVolume: 0.3,
      duckVolume: 0.1,
      originalIds: [TEST_PLAYLIST[0]!.id],
    });
    expect(videos[0]!.volume).toBe(0.3);
    expect(music.getAttribute("src")).toBeNull();
    expect(
      parseAudio({ musicVolume: 3, videoVolume: -2, musicUrls: ["javascript:alert(1)"] }),
    ).toMatchObject({ musicVolume: 1, videoVolume: 0, musicUrls: [] });
  });
  it("updates the queue without touching the playing video or music", () => {
    player.start(true);
    videos[0]!.currentTime = 3;
    const activeLoad = vi.spyOn(videos[0]!, "load").mockClear();
    const musicLoad = vi.mocked(music.load).mockClear();
    const added = { ...TEST_PLAYLIST[1]!, id: "added", url: "https://example.com/added.mp4" };
    player.updatePlaylist([TEST_PLAYLIST[0]!, added, TEST_PLAYLIST[1]!]);
    expect(videos[0]!.currentTime).toBe(3);
    expect(videos[0]!.getAttribute("src")).toBe(TEST_PLAYLIST[0]!.url);
    expect(videos[0]!.paused).toBe(false);
    expect(videos[1]!.getAttribute("src")).toBe(added.url);
    expect(musicLoad).not.toHaveBeenCalled();
    // Prototype load spy also sees standby loads; inspect its receiver.
    expect(activeLoad.mock.contexts.filter((c) => c === videos[0])).toHaveLength(0);
    videos[0]!.dispatchEvent(new Event("ended"));
    videos[1]!.dispatchEvent(new Event("playing"));
    expect(videos[1]!.getAttribute("src")).toBe(added.url);
    expect(videos[0]!.getAttribute("src")).toBe(TEST_PLAYLIST[1]!.url);
  });
  it("finishes a removed current video, handles an empty list and resumes when content returns", () => {
    player.start(true);
    const src = videos[0]!.src;
    player.updatePlaylist([]);
    expect(videos[0]!.src).toBe(src);
    expect(videos[0]!.paused).toBe(false);
    expect(videos[1]!.getAttribute("src")).toBeNull();
    Object.defineProperty(videos[0]!, "ended", { value: true, configurable: true });
    videos[0]!.dispatchEvent(new Event("ended"));
    player.updatePlaylist([TEST_PLAYLIST[1]!]);
    videos[1]!.dispatchEvent(new Event("playing"));
    expect(videos[1]!.getAttribute("src")).toBe(TEST_PLAYLIST[1]!.url);
    expect(videos[1]!.style.zIndex).toBe("1");
  });
  it("defers a playlist snapshot received during a handoff until playing", () => {
    player.start(true);
    player.next();
    const added = { ...TEST_PLAYLIST[0]!, id: "new", url: "https://example.com/new.mp4" };
    player.updatePlaylist([added]);
    expect(videos[1]!.getAttribute("src")).toBe(TEST_PLAYLIST[1]!.url);
    videos[1]!.dispatchEvent(new Event("playing"));
    expect(videos[0]!.getAttribute("src")).toBe(added.url);
    expect(videos[1]!.getAttribute("src")).toBe(TEST_PLAYLIST[1]!.url);
  });
  it("changes volume remotely without restarting unchanged music", () => {
    player.start(true);
    const load = vi.mocked(music.load).mockClear();
    player.updateSettings({
      musicUrls: ["https://example.com/music.mp3"],
      musicVolume: 0.8,
      videoVolume: 0.5,
      duckVolume: 0.25,
      originalIds: [TEST_PLAYLIST[0]!.id],
    });
    expect(videos[0]!.volume).toBe(0.5);
    expect(music.volume).toBe(0.2);
    expect(load).not.toHaveBeenCalled();
  });
});
