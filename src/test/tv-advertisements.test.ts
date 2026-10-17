import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { TvPlayback } from "@/lib/tv-playback";
import { DEFAULT_ADS, type Advertisement } from "@/lib/ad-scheduler";
import type { Video } from "@/lib/backend";
vi.mock("@/lib/ad-clock", () => ({ integrationAdIntervalMs: 60000 }));
const main: Video[] = [1, 2, 3].map((n) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  title: `Main ${n}`,
  url: `https://example.com/main${n}.mp4`,
  duration_seconds: 120,
  sort_order: n,
  is_active: true,
  is_test: true,
}));
const ads: Advertisement[] = [1, 2, 3].map((n) => ({
  ...main[0]!,
  id: `10000000-0000-4000-8000-00000000000${n}`,
  title: `Ad ${n}`,
  url: `https://example.com/ad${n}.mp4`,
  original_sound: n === 1,
}));
let videos: HTMLVideoElement[], music: HTMLAudioElement, player: TvPlayback;
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    Object.defineProperty(this, "ended", { value: false, configurable: true });
    this.currentTime = 0;
  });
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
  player = new TvPlayback(videos, music, main, vi.fn());
  player.updateSettings({
    musicUrls: ["https://example.com/music.mp3"],
    musicVolume: 0.8,
    videoVolume: 0.6,
    duckVolume: 0.25,
    originalIds: [],
  });
  configure();
  player.start(true);
  playing(0);
});
afterEach(() => {
  player.dispose();
  expect(vi.getTimerCount()).toBe(0);
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function configure(count = 2, enabled = true, list = ads) {
  player.updateAdvertisements({
    settings: { ...DEFAULT_ADS, enabled, block_count: count },
    advertisements: list,
  });
}
function playing(slot: number) {
  videos[slot]!.dispatchEvent(new Event("playing"));
}
function end(slot: number) {
  Object.defineProperty(videos[slot]!, "ended", { value: true, configurable: true });
  videos[slot]!.dispatchEvent(new Event("ended"));
}
function due(slot = 0) {
  for (let i = 0; i < 21; i++) {
    videos[slot]!.currentTime += 3;
    music.currentTime += 3;
    vi.advanceTimersByTime(3000);
  }
}
function fail(slot: number) {
  for (const delay of [2000, 4000, 8000]) {
    videos[slot]!.dispatchEvent(new Event("error"));
    vi.advanceTimersByTime(delay);
  }
}
it("waits for natural end, ignores duplicate ended, preloads ads and resumes next main without music restart", () => {
  due();
  expect(videos[0]!.src).toBe(main[0]!.url);
  const musicLoad = vi.mocked(music.load).mockClear();
  const musicPlay = vi.mocked(music.play).mockClear();
  end(0);
  end(0);
  expect(videos[1]!.src).toBe(ads[0]!.url);
  playing(1);
  expect(videos[0]!.src).toBe(ads[1]!.url);
  expect(music.volume).toBeCloseTo(0.2);
  end(1);
  playing(0);
  expect(videos[1]!.src).toBe(main[1]!.url);
  expect(music.volume).toBe(0.8);
  end(0);
  playing(1);
  expect(videos[1]!.src).toBe(main[1]!.url);
  expect(videos[0]!.src).toBe(main[2]!.url);
  expect(musicLoad.mock.contexts.filter((c) => c === music)).toHaveLength(0);
  expect(musicPlay.mock.contexts.filter((c) => c === music)).toHaveLength(0);
});
it("does not insert ads after manual next or while OFF", () => {
  due();
  player.next();
  expect(videos[1]!.src).toBe(main[1]!.url);
  playing(1);
  configure(2, false);
  end(1);
  playing(0);
  expect(videos[0]!.src).toBe(main[2]!.url);
});
it("keeps block snapshot and latest main playlist while settings change during transition", () => {
  due();
  end(0);
  player.updatePlaylist([main[0]!, main[2]!, main[1]!]);
  configure(1, true, [ads[2]!]);
  player.updateSettings({
    musicUrls: ["https://example.com/music.mp3"],
    musicVolume: 0.4,
    videoVolume: 0,
    duckVolume: 0,
    originalIds: [],
  });
  playing(1);
  expect(music.volume).toBe(0.4);
  expect(videos[1]!.volume).toBe(0);
  end(1);
  playing(0);
  expect(videos[0]!.src).toBe(ads[1]!.url);
  end(0);
  playing(1);
  expect(videos[1]!.src).toBe(main[2]!.url);
});
it("finishes current ad after disabling and returns to next main", () => {
  due();
  end(0);
  playing(1);
  configure(2, false);
  end(1);
  playing(0);
  expect(videos[0]!.src).toBe(main[1]!.url);
});
it("skips two broken ads with bounded retries and restores the main playlist", () => {
  due();
  end(0);
  fail(1);
  expect(videos[1]!.src).toBe(ads[1]!.url);
  fail(1);
  expect(videos[1]!.src).toBe(main[1]!.url);
  playing(1);
  expect(music.volume).toBe(0.8);
});
it("recovers after first broken ad and resets source retry budget", () => {
  due();
  end(0);
  fail(1);
  playing(1);
  expect(videos[1]!.src).toBe(ads[1]!.url);
  const load = vi.mocked(videos[1]!.load).mockClear();
  videos[1]!.dispatchEvent(new Event("error"));
  vi.advanceTimersByTime(2000);
  expect(load).toHaveBeenCalled();
  expect(videos[1]!.src).toBe(ads[1]!.url);
});
it("handles one main, one ad and empty advertisements", () => {
  player.updatePlaylist([main[0]!]);
  configure(3, true, [ads[0]!]);
  due();
  end(0);
  playing(1);
  end(1);
  playing(0);
  expect(videos[0]!.src).toBe(main[0]!.url);
  configure(0, true, []);
  due();
  end(0);
  playing(1);
  expect(videos[1]!.src).toBe(main[0]!.url);
});
it("resets due clock on offline and hidden interruption without interrupting music", () => {
  due();
  window.dispatchEvent(new Event("offline"));
  end(0);
  playing(1);
  expect(videos[1]!.src).toBe(main[1]!.url);
  due(1);
  Object.defineProperty(document, "hidden", { value: true, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
  Object.defineProperty(document, "hidden", { value: false, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
  end(1);
  playing(0);
  expect(videos[0]!.src).toBe(main[2]!.url);
});
it("does not duck main sound at zero video volume or when globally muted", () => {
  player.updateSettings({
    musicUrls: ["https://example.com/music.mp3"],
    musicVolume: 1,
    videoVolume: 0,
    duckVolume: 0,
    originalIds: [main[0]!.id],
  });
  expect(music.volume).toBe(1);
  player.toggleSound();
  expect(music.muted).toBe(true);
  expect(videos[0]!.muted).toBe(true);
});
it("resets a due clock on pause and repeatedly returns to the correct next main", () => {
  due();
  Object.defineProperty(videos[0]!, "paused", { value: true, configurable: true });
  videos[0]!.dispatchEvent(new Event("pause"));
  player.resume();
  end(0);
  playing(1);
  expect(videos[1]!.src).toBe(main[1]!.url);
  let active = 1;
  for (let cycle = 0; cycle < 6; cycle++) {
    due(active);
    end(active);
    active = 1 - active;
    playing(active);
    expect(videos[active]!.src).toBe(ads[(cycle * 2) % 3]!.url);
    end(active);
    active = 1 - active;
    playing(active);
    end(active);
    active = 1 - active;
    playing(active);
    expect(videos[active]!.src).toBe(main[(cycle + 2) % 3]!.url);
  }
});
it("a stalled ad has a bounded watchdog budget and cannot trap the main queue", () => {
  configure(1);
  due();
  end(0);
  playing(1);
  vi.advanceTimersByTime(90000);
  expect(videos[0]!.src).toBe(main[1]!.url);
});
it("retains accumulated playback across short clips and a zero-progress handoff tick", () => {
  let active = 0,
    found = false;
  for (let cycle = 0; cycle < 12; cycle++) {
    for (let tick = 0; tick < 2; tick++) {
      videos[active]!.currentTime += 3;
      music.currentTime += 3;
      vi.advanceTimersByTime(3000);
    }
    end(active);
    active = 1 - active;
    if (videos[active]!.src === ads[0]!.url) {
      found = true;
      break;
    }
    playing(active);
    vi.advanceTimersByTime(3000); // new element still at zero: no pause or debt reset
  }
  expect(found).toBe(true);
});
it("uses the latest sound flag if it changed after ad preloading", () => {
  configure(1, true, [{ ...ads[0]!, original_sound: false }]);
  due();
  expect(videos[1]!.src).toBe(ads[0]!.url);
  configure(1, true, [ads[0]!]);
  end(0);
  playing(1);
  expect(videos[1]!.muted).toBe(false);
  expect(music.volume).toBeCloseTo(0.2);
});
it("repairs the preloaded main index if its source moves during the final ad", () => {
  configure(1);
  due();
  end(0);
  playing(1);
  expect(videos[0]!.src).toBe(main[1]!.url);
  player.updatePlaylist([main[2]!, main[0]!, main[1]!]);
  end(1);
  playing(0);
  expect(videos[0]!.src).toBe(main[1]!.url);
  expect(videos[1]!.src).toBe(main[2]!.url);
});
it("can finish an ad with an empty main snapshot and resume when main videos return", () => {
  configure(1);
  due();
  end(0);
  playing(1);
  player.updatePlaylist([]);
  end(1);
  player.updatePlaylist([main[1]!]);
  playing(0);
  expect(videos[0]!.src).toBe(main[1]!.url);
  expect(music.paused).toBe(false);
});
