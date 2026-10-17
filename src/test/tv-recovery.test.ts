import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TvPlayback } from "@/lib/tv-playback";
import type { Video } from "@/lib/backend";

const clips: Video[] = Array.from({ length: 4 }, (_, i) => ({
  id: `00000000-0000-4000-8000-00000000000${i + 1}`,
  title: `Clip ${i + 1}`,
  url: `https://example.com/${i + 1}.mp4`,
  duration_seconds: 30,
  sort_order: i,
  is_active: true,
  is_test: true,
}));
const audioSettings = {
  musicUrls: ["https://example.com/music.mp3"],
  musicVolume: 0.5,
  videoVolume: 0.8,
  duckVolume: 0.2,
  originalIds: [clips[0]!.id],
};

describe("TV recovery regressions", () => {
  let videos: HTMLVideoElement[], music: HTMLAudioElement, p: TvPlayback;
  const report = vi.fn<(message: string, blocked?: boolean, persistent?: boolean) => void>();
  let musicClock: ReturnType<typeof setInterval>;
  const bad = new Set<string>();
  function build(items = clips) {
    p?.dispose();
    p = new TvPlayback(videos, music, items, report);
    p.updateSettings(audioSettings);
  }
  function playing(v: HTMLVideoElement) {
    v.dispatchEvent(new Event("playing"));
  }
  async function advance(ms: number) {
    await vi.advanceTimersByTimeAsync(ms);
  }
  beforeEach(() => {
    vi.useFakeTimers();
    bad.clear();
    report.mockReset();
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    videos = [document.createElement("video"), document.createElement("video")];
    music = document.createElement("audio");
    [...videos, music].forEach((m) => {
      const paused = (value: boolean) =>
        Object.defineProperty(m, "paused", { configurable: true, value });
      Object.defineProperties(m, {
        load: {
          configurable: true,
          value: vi.fn(() => {
            m.currentTime = 0;
            paused(true);
          }),
        },
        pause: { configurable: true, value: vi.fn(() => paused(true)) },
        play: {
          configurable: true,
          value: vi.fn(() => {
            if (bad.has(m.getAttribute("src") || ""))
              return Promise.reject({ name: "NotSupportedError" });
            paused(false);
            return Promise.resolve();
          }),
        },
      });
    });
    // Model continuously playing music while the video decoder is failing/stalled.
    musicClock = setInterval(() => {
      if (!music.paused) music.currentTime += 1;
    }, 1000);
    build();
  });
  afterEach(() => {
    p.dispose();
    clearInterval(musicClock);
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  it("loops a single clip between both slots without reloading music", () => {
    build([clips[0]!]);
    p.start(true);
    playing(videos[0]!);
    const load = vi.mocked(music.load).mockClear(),
      play = vi.mocked(music.play).mockClear();
    for (let i = 0; i < 5; i++) {
      videos[i % 2]!.dispatchEvent(new Event("ended"));
      playing(videos[1 - (i % 2)]!);
      expect(videos[1 - (i % 2)]!.src).toBe(clips[0]!.url);
      expect(videos[1 - (i % 2)]!.style.zIndex).toBe("1");
    }
    expect(load).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });
  it("gives two broken incoming files separate retry budgets and then reaches a good clip", async () => {
    bad.add(clips[1]!.url);
    bad.add(clips[2]!.url);
    p.start(true);
    playing(videos[0]!);
    videos[0]!.currentTime = 7;
    const load = vi.mocked(music.load).mockClear();
    p.next();
    await advance(14000);
    expect(videos[1]!.src).toBe(clips[2]!.url);
    await advance(2000); // First retry of second bad source, not an immediate skip.
    expect(videos[1]!.src).toBe(clips[2]!.url);
    await advance(12000);
    expect(videos[1]!.src).toBe(clips[3]!.url);
    expect(videos[0]!.currentTime).toBe(7);
    expect(videos[0]!.paused).toBe(false);
    playing(videos[1]!);
    expect(videos[1]!.style.zIndex).toBe("1");
    expect(load).not.toHaveBeenCalled();
    expect(music.paused).toBe(false);
  });
  it("backs off a wholly broken playlist for 30 seconds and cannot bypass it with online/next", async () => {
    build(clips.slice(0, 2));
    clips.slice(0, 2).forEach((v) => bad.add(v.url));
    p.start(true);
    const load = vi.mocked(music.load).mockClear();
    await advance(28000);
    expect(report).toHaveBeenCalledWith(
      expect.stringContaining("Усі ролики недоступні"),
      false,
      true,
    );
    const plays = () => videos.reduce((n, v) => n + vi.mocked(v.play).mock.calls.length, 0);
    const count = plays();
    expect(count).toBe(6); // initial + two retries for each file
    for (let i = 0; i < 10; i++) {
      window.dispatchEvent(new Event("online"));
      p.next();
    }
    await advance(29999);
    expect(plays()).toBe(count);
    await advance(1);
    expect(plays()).toBe(count + 1);
    await advance(2000);
    expect(plays()).toBe(count + 2); // fresh retry budget after cooldown
    expect(load).not.toHaveBeenCalled();
    expect(music.paused).toBe(false);
    await advance(240000);
    expect(plays()).toBeLessThan(40);
  });
  it("a single broken clip releases pending and retries only after cooldown", async () => {
    build([clips[0]!]);
    bad.add(clips[0]!.url);
    p.start(true);
    await advance(14000);
    expect(report).toHaveBeenCalledWith(expect.stringContaining("30 секунд"), false, true);
    expect(vi.mocked(videos[1]!.play)).not.toHaveBeenCalled();
    await advance(30000);
    expect(videos[1]!.src).toBe(clips[0]!.url);
    expect(vi.mocked(videos[1]!.play)).toHaveBeenCalledTimes(1);
    p.dispose();
    clearInterval(musicClock);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("starts a fresh watchdog window when a pending source changes", async () => {
    p.start(true);
    p.next();
    for (const delay of [2000, 4000, 8000]) {
      videos[1]!.dispatchEvent(new Event("error"));
      await advance(delay);
    }
    expect(videos[1]!.src).toBe(clips[2]!.url);
    const count = vi.mocked(videos[1]!.load).mock.calls.length;
    await advance(15000);
    expect(vi.mocked(videos[1]!.load)).toHaveBeenCalledTimes(count);
    await advance(3000);
    expect(vi.mocked(videos[1]!.load)).toHaveBeenCalledTimes(count + 1);
    expect(videos[1]!.src).toBe(clips[2]!.url);
  });
  it("resets same-source attempts on actual playback progress", async () => {
    p.start(true);
    videos[0]!.dispatchEvent(new Event("error"));
    await advance(2000);
    videos[0]!.currentTime = 1;
    await advance(1000);
    const count = vi.mocked(videos[0]!.load).mock.calls.length;
    videos[0]!.dispatchEvent(new Event("error"));
    await advance(2000);
    expect(vi.mocked(videos[0]!.load)).toHaveBeenCalledTimes(count + 1);
    expect(videos[0]!.src).toBe(clips[0]!.url);
  });
  it("ignores a late play rejection after the element gets another source", async () => {
    let reject!: (e: unknown) => void;
    vi.mocked(videos[0]!.play).mockImplementationOnce(
      () =>
        new Promise((_resolve, r) => {
          reject = r;
        }),
    );
    p.start(true);
    p.next();
    playing(videos[1]!);
    reject({ name: "NotAllowedError" });
    await advance(0);
    expect(report.mock.calls.some((call) => call[1] === true)).toBe(false);
    expect(videos[1]!.paused).toBe(false);
    expect(music.paused).toBe(false);
  });
  it("applies settings during a handoff and preserves music and waiting state", () => {
    p.start(true);
    playing(videos[0]!);
    p.next();
    videos[0]!.dispatchEvent(new Event("waiting"));
    const load = vi.mocked(music.load).mockClear(),
      play = vi.mocked(music.play).mockClear();
    p.updateSettings({
      ...audioSettings,
      musicVolume: 0.6,
      videoVolume: 0.4,
      duckVolume: 0.25,
      originalIds: [clips[0]!.id, clips[1]!.id],
    });
    expect(videos[0]!.volume).toBe(0.4);
    expect(videos[1]!.muted).toBe(true);
    expect(music.volume).toBe(0.6);
    playing(videos[1]!);
    expect(videos[1]!.muted).toBe(false);
    expect(music.volume).toBe(0.15);
    expect(load).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });
  it("consumes a queued fresh playlist even when the incoming clip never plays", async () => {
    bad.add(clips[1]!.url);
    p.start(true);
    playing(videos[0]!);
    p.next();
    p.updatePlaylist([clips[3]!]);
    await advance(14000);
    expect(videos[1]!.src).toBe(clips[3]!.url);
    expect(videos[0]!.src).toBe(clips[0]!.url);
    playing(videos[1]!);
    expect(videos[1]!.style.zIndex).toBe("1");
  });
  it("gives a new music track its own recovery budget", async () => {
    const tracks = [
      "https://example.com/bad1.mp3",
      "https://example.com/bad2.mp3",
      "https://example.com/good.mp3",
    ];
    bad.add(tracks[0]!);
    bad.add(tracks[1]!);
    p.updateSettings({ ...audioSettings, musicUrls: tracks });
    p.start(true);
    await advance(14000);
    expect(music.src).toBe(tracks[1]);
    await advance(2000);
    expect(music.src).toBe(tracks[1]);
    await advance(12000);
    expect(music.src).toBe(tracks[2]);
  });
});
