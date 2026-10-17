import type { Video } from "./backend";
import { DEFAULT_AUDIO, parseAudio, type AudioSettings } from "./audio-settings";
import { AdScheduler, type AdConfiguration } from "./ad-scheduler";
import { integrationAdIntervalMs } from "./ad-clock";

// Two stable elements; never replace the outgoing source before the incoming plays.
export class TvPlayback {
  private active = 0;
  private pending: number | null = null;
  private index = 0;
  private musicIndex = 0;
  private sound = false;
  private running = false;
  private disposed = false;
  private settings: AudioSettings = DEFAULT_AUDIO;
  private current: Video | null = null;
  private queued: Video[] | null = null;
  private ads = new AdScheduler(integrationAdIntervalMs);
  private main: { items: Video[]; currentId: string | undefined } | null = null;
  private blockOriginal = new Map<string, boolean>();
  private lastTick = Date.now();
  private generations = new Map<HTMLMediaElement, number>();
  private failedVideos = new Set<string>();
  private cooldown: ReturnType<typeof setTimeout> | undefined;
  private waiting = false;
  private progress = new Map<HTMLMediaElement, { time: number; at: number }>();
  private attempts = new Map<HTMLMediaElement, number>();
  private timers = new Map<HTMLMediaElement, ReturnType<typeof setTimeout>>();
  private cleanups: (() => void)[] = [];
  private watchdog: ReturnType<typeof setInterval>;
  constructor(
    private videos: HTMLVideoElement[],
    private music: HTMLAudioElement,
    private items: Video[],
    private report: (message: string, blocked?: boolean, persistent?: boolean) => void,
  ) {
    this.current = items[0] || null;
    videos.forEach((v, slot) => {
      v.muted = true;
      v.preload = "auto";
      v.playsInline = true;
      v.setAttribute("webkit-playsinline", "");
      this.listen(v, "ended", () => {
        if (slot === this.active && this.pending === null) this.naturalEnd();
      });
      this.listen(v, "playing", () => {
        if (this.cooldown !== undefined) return;
        this.cancel(v);
        this.progress.set(v, { time: v.currentTime, at: Date.now() });
        if (this.pending === slot) {
          const old = this.videos[this.active]!;
          old.pause();
          old.muted = true;
          old.style.zIndex = "0";
          v.style.zIndex = "1";
          this.active = slot;
          this.pending = null;
          this.index = Number(v.dataset["index"]);
          this.current = this.items[this.index] || null;
          this.prepareStandby();
          if (this.queued !== null) {
            const queued = this.queued;
            this.queued = null;
            this.updatePlaylist(queued);
          }
        }
        if (slot === this.active) {
          this.waiting = false;
          this.report(this.current?.title || "");
          this.mix();
        }
      });
      this.listen(v, "error", () => {
        if (this.running && (slot === this.active || slot === this.pending)) this.recover(v);
      });
      this.listen(v, "pause", () => {
        if (slot === this.active && !v.ended && this.pending === null) this.ads.tick(0, false);
        this.mix();
      });
      this.listen(v, "waiting", () => {
        if (slot === this.active) {
          this.waiting = true;
          this.mix();
        }
      });
    });
    this.listen(music, "ended", () => this.nextMusic());
    this.listen(music, "playing", () => {
      this.cancel(music);
      this.progress.set(music, { time: music.currentTime, at: Date.now() });
    });
    this.listen(music, "error", () => {
      if (this.running) this.recover(music);
    });
    const online = () => {
      if (this.running) {
        this.resume();
        if (this.music.error) this.loadMusic();
      }
    };
    const visible = () => {
      this.ads.tick(0, false);
      this.lastTick = Date.now();
      if (!document.hidden && this.running) this.resume();
    };
    const offline = () => {
      this.ads.tick(0, false);
      this.lastTick = Date.now();
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visible);
    this.cleanups.push(() => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visible);
    });
    this.watchdog = setInterval(() => {
      const now = Date.now();
      const activeVideo = this.videos[this.active]!;
      const progressing =
        activeVideo.currentTime > (this.progress.get(activeVideo)?.time ?? activeVideo.currentTime);
      this.ads.tick(
        progressing && !activeVideo.paused && !activeVideo.ended && this.pending === null
          ? now - this.lastTick
          : 0,
        this.running &&
          !document.hidden &&
          navigator.onLine &&
          !this.waiting &&
          this.cooldown === undefined,
      );
      this.lastTick = now;
      const upcoming = this.main || this.pending !== null ? [] : this.ads.peekBlock();
      if (upcoming.length) {
        const first = upcoming[0]!;
        this.blockOriginal = new Map(upcoming.map((a) => [a.id, a.original_sound]));
        if (
          this.videos[1 - this.active]!.dataset["sourceKey"] !==
          JSON.stringify([first.id, first.url])
        )
          this.prepare(1 - this.active, 0, upcoming, true);
      }
      if (!this.running || document.hidden) return;
      [this.videos[this.pending ?? this.active]!, music].forEach((m) => {
        if (!m.getAttribute("src") || (m === music && !this.sound)) return;
        if (m !== music && this.cooldown !== undefined) return;
        if (m !== music && m.ended && !this.items.length) return;
        const p = this.progress.get(m);
        if (!p || m.currentTime !== p.time) {
          this.progress.set(m, { time: m.currentTime, at: Date.now() });
          if (p && m.currentTime > p.time && !m.seeking && !m.paused) {
            this.attempts.set(m, 0);
            this.cancel(m);
            if (m !== music) this.failedVideos.clear();
          }
        } else if (Date.now() - p.at > 15000) this.recover(m);
      });
    }, 3000);
  }
  updateAdvertisements(configuration: AdConfiguration) {
    if (!this.disposed) this.ads.update(configuration);
  }
  private mainNext() {
    if (!this.main) return 0;
    return (
      (this.main.items.findIndex((v) => v.id === this.main!.currentId) + 1) %
      (this.main.items.length || 1)
    );
  }
  private prepareStandby() {
    if (this.main && this.index === this.items.length - 1) {
      this.prepare(1 - this.active, this.mainNext(), this.main.items);
    } else this.prepare(1 - this.active, (this.index + 1) % this.items.length);
  }
  private naturalEnd() {
    if (this.main) {
      this.next();
      return;
    }
    if (!this.items.length) {
      this.next();
      return;
    }
    const block = this.ads.takeBlock();
    if (!block.length || !this.items.length) {
      this.next();
      return;
    }
    this.main = { items: this.items, currentId: this.current?.id };
    this.blockOriginal = new Map(block.map((a) => [a.id, a.original_sound]));
    this.items = block;
    this.index = -1;
    this.next();
  }
  private finishAdBlock() {
    if (!this.main) return;
    const main = this.main;
    this.main = null;
    this.items = main.items;
    this.index = this.items.findIndex((v) => v.id === main.currentId);
    this.ads.finish();
    this.failedVideos.clear();
    if (!this.items.length) {
      this.report("Основний плейлист порожній. Очікуємо оновлення.", false, true);
      this.mix(true);
      return;
    }
    // Keep outgoing ad sound semantics until the next main element actually plays.
    this.next();
  }
  updateSettings(settings: AudioSettings) {
    if (this.disposed) return;
    const previous = this.settings.musicUrls.join("\n");
    this.settings = parseAudio(settings);
    this.mix();
    if (previous !== this.settings.musicUrls.join("\n")) {
      this.musicIndex = 0;
      this.loadMusic();
    }
  }
  updatePlaylist(items: Video[]) {
    if (this.disposed) return;
    if (this.main) {
      this.main.items = items;
      return;
    }
    if (this.pending !== null) {
      this.queued = items;
      return;
    }
    if (JSON.stringify(items) === JSON.stringify(this.items)) return;
    const sourcesChanged =
      JSON.stringify(items.map((v) => [v.id, v.url])) !==
      JSON.stringify(this.items.map((v) => [v.id, v.url]));
    const wasCooling = this.cooldown !== undefined;
    if (sourcesChanged) {
      this.failedVideos.clear();
      clearTimeout(this.cooldown);
      this.cooldown = undefined;
    }
    this.items = items;
    this.index = items.findIndex((item) => item.id === this.current?.id);
    const standby = this.videos[1 - this.active]!;
    this.cancel(standby);
    if (!items.length) {
      standby.pause();
      standby.removeAttribute("src");
      standby.load();
      this.report("Плейлист порожній. Поточний ролик буде завершено.");
      return;
    }
    if (!this.current) {
      this.current = items[0]!;
      this.index = 0;
      this.prepare(this.active, 0);
      this.prepare(1 - this.active, 1 % items.length);
      if (this.running) {
        this.mix();
        this.play(this.videos[this.active]!);
      }
    } else {
      this.prepare(1 - this.active, (this.index + 1) % items.length);
      if (this.running && (this.videos[this.active]!.ended || (wasCooling && sourcesChanged)))
        this.next();
    }
  }
  private listen(m: HTMLMediaElement, name: string, fn: () => void) {
    m.addEventListener(name, fn);
    this.cleanups.push(() => m.removeEventListener(name, fn));
  }
  private prepare(
    slot: number,
    index: number,
    items = this.items,
    isAdvertisement = !!this.main && items === this.items,
  ) {
    const v = this.videos[slot]!,
      item = items[index];
    if (!item) return;
    this.resetSource(v);
    v.pause();
    v.muted = true;
    v.dataset["index"] = String(index);
    v.dataset["sourceKey"] = JSON.stringify([item.id, item.url]);
    v.dataset["originalAd"] = isAdvertisement
      ? String(this.blockOriginal.get(item.id) === true)
      : "";
    v.src = item.url;
    v.load();
    this.progress.set(v, { time: 0, at: Date.now() });
  }
  private resetSource(m: HTMLMediaElement) {
    this.cancel(m);
    m.onloadedmetadata = null;
    this.attempts.delete(m);
    this.progress.delete(m);
    this.generations.set(m, (this.generations.get(m) || 0) + 1);
  }
  private play(m: HTMLMediaElement) {
    if (this.disposed) return;
    const generation = this.generations.get(m);
    const rejected = (e: unknown) => {
      const name = (e as { name?: string } | null)?.name;
      if (this.disposed || this.generations.get(m) !== generation || name === "AbortError") return;
      if (name === "NotAllowedError") {
        this.report("Натисніть «Продовжити» для запуску звуку та відео", true);
        this.running = false;
        this.music.pause();
        this.videos.forEach((v) => v.pause());
      } else this.recover(m);
    };
    try {
      const promise = m.play();
      if (promise && promise.catch) promise.catch(rejected);
    } catch (error) {
      rejected(error);
    }
  }
  start(sound: boolean) {
    this.running = true;
    this.sound = sound;
    if (!this.items.length) {
      this.loadMusic();
      return;
    }
    if (!this.videos[this.active]!.getAttribute("src")) {
      this.prepare(this.active, this.index);
      this.prepare(1 - this.active, (this.index + 1) % this.items.length);
    }
    this.mix();
    if (this.cooldown === undefined) this.play(this.videos[this.pending ?? this.active]!);
    this.loadMusic();
  }
  resume() {
    this.running = true;
    const v = this.videos[this.pending ?? this.active]!;
    if (v.error && this.cooldown === undefined) this.recover(v);
    this.mix();
    if (
      !v.error &&
      this.cooldown === undefined &&
      v.getAttribute("src") &&
      !(v.ended && !this.items.length)
    )
      this.play(v);
    if (this.sound && this.settings.musicUrls.length) this.play(this.music);
  }
  next() {
    if (
      this.main &&
      this.pending === null &&
      (this.index >= this.items.length - 1 || !this.ads.enabled)
    ) {
      this.finishAdBlock();
      return;
    }
    if (!this.items.length || this.pending !== null || this.cooldown !== undefined) {
      this.mix(true);
      return;
    }
    const slot = 1 - this.active,
      v = this.videos[slot]!;
    const index = (this.index + 1) % this.items.length;
    this.cancel(v);
    this.cancel(this.videos[this.active]!);
    if (
      v.dataset["sourceKey"] !== JSON.stringify([this.items[index]!.id, this.items[index]!.url]) ||
      v.error
    )
      this.prepare(slot, index);
    // A preloaded source can retain its URL while a fresh main snapshot moves its index.
    v.dataset["index"] = String(index);
    v.dataset["originalAd"] = this.main
      ? String(this.blockOriginal.get(this.items[index]!.id) === true)
      : "";
    this.pending = slot;
    this.progress.set(v, { time: v.currentTime, at: Date.now() });
    // Incoming stays muted until playing, so two video soundtracks never overlap.
    this.play(v);
  }
  toggleSound() {
    this.sound = !this.sound;
    this.mix();
    if (this.sound) this.loadMusic();
    else this.music.pause();
  }
  private mix(waiting = this.waiting) {
    const v = this.videos[this.active]!;
    const original = v.dataset["originalAd"]
      ? v.dataset["originalAd"] === "true"
      : this.settings.originalIds.includes(this.current?.id || "");
    this.videos.forEach((video, slot) => {
      video.muted = !this.sound || !original || slot !== this.active;
      video.volume = this.settings.videoVolume;
    });
    this.music.muted = !this.sound;
    this.music.volume =
      this.settings.musicVolume *
      (this.sound && original && this.settings.videoVolume > 0 && !v.paused && !v.ended && !waiting
        ? this.settings.duckVolume
        : 1);
  }
  private loadMusic() {
    this.cancel(this.music);
    const url = this.settings.musicUrls[this.musicIndex];
    if (!url) {
      this.resetSource(this.music);
      this.music.pause();
      this.music.removeAttribute("src");
      this.music.load();
      return;
    }
    if (this.music.getAttribute("src") !== url) {
      this.resetSource(this.music);
      this.music.src = url;
      this.music.load();
      this.progress.set(this.music, { time: 0, at: Date.now() });
    }
    this.mix();
    if (this.sound && this.running) this.play(this.music);
  }
  private nextMusic() {
    this.musicIndex = (this.musicIndex + 1) % (this.settings.musicUrls.length || 1);
    this.music.removeAttribute("src");
    this.loadMusic();
  }
  private cancel(m: HTMLMediaElement) {
    clearTimeout(this.timers.get(m));
    this.timers.delete(m);
  }
  private recover(m: HTMLMediaElement) {
    if (!this.running || this.disposed || this.timers.has(m)) return;
    if (m !== this.music && m !== this.videos[this.pending ?? this.active]) return;
    if (m !== this.music && this.cooldown !== undefined) return;
    if (m !== this.music) {
      this.waiting = true;
      this.ads.tick(0, false);
      this.mix(true);
    }
    const attempt = (this.attempts.get(m) || 0) + 1;
    this.attempts.set(m, attempt);
    if (this.cooldown === undefined)
      this.report(m === this.music ? "Відновлення музики…" : "Відновлення відео…");
    const generation = this.generations.get(m);
    this.timers.set(
      m,
      setTimeout(
        () => {
          this.timers.delete(m);
          if (!this.running || this.disposed || this.generations.get(m) !== generation) return;
          if (attempt > 2) {
            if (m === this.music) this.nextMusic();
            else this.skipFailedVideo(m as HTMLVideoElement);
          } else {
            const position = m.currentTime;
            // Same source retry: invalidate old play promises but retain its retry budget.
            this.generations.set(m, (this.generations.get(m) || 0) + 1);
            m.load();
            this.progress.set(m, { time: 0, at: Date.now() });
            // Seeking is best-effort; some TV engines reject it until metadata arrives.
            const seek = () => {
              if (Number.isFinite(position) && position > 0) {
                try {
                  m.currentTime = position;
                } catch {
                  /* restart */
                }
              }
            };
            m.onloadedmetadata = () => {
              m.onloadedmetadata = null;
              seek();
              this.progress.set(m, { time: m.currentTime, at: Date.now() });
            };
            this.play(m);
          }
        },
        Math.min(30000, 1000 * Math.pow(2, Math.min(attempt, 5))),
      ),
    );
  }
  private skipFailedVideo(v: HTMLVideoElement) {
    const failedKey = v.dataset["sourceKey"] || "";
    this.failedVideos.add(failedKey);
    let failedIndex = Number(v.dataset["index"]);
    this.pending = null;
    this.cancel(v);
    v.pause();
    v.muted = true;
    if (this.main) {
      const nextIndex = failedIndex + 1;
      if (nextIndex >= this.items.length || !this.ads.enabled) this.finishAdBlock();
      else {
        this.prepare(1 - this.active, nextIndex);
        this.pending = 1 - this.active;
        this.play(this.videos[this.pending]!);
      }
      return;
    }
    if (this.queued !== null) {
      const queued = this.queued;
      this.queued = null;
      this.updatePlaylist(queued);
      if (this.pending !== null || !this.items.length) return;
      failedIndex = this.items.findIndex(
        (item) => JSON.stringify([item.id, item.url]) === failedKey,
      );
    }
    if (!this.items.length) {
      this.mix(true);
      return;
    }
    for (let offset = 1; offset <= this.items.length; offset++) {
      const index = (failedIndex + offset) % this.items.length;
      const item = this.items[index]!;
      if (!this.failedVideos.has(JSON.stringify([item.id, item.url]))) {
        const slot = 1 - this.active;
        this.prepare(slot, index);
        this.pending = slot;
        this.play(this.videos[slot]!);
        return;
      }
    }
    this.videos.forEach((video) => this.cancel(video));
    this.report("Усі ролики недоступні. Повторна спроба через 30 секунд.", false, true);
    this.mix(true);
    this.cooldown = setTimeout(() => {
      this.cooldown = undefined;
      this.failedVideos.clear();
      if (!this.disposed && this.running && this.items.length) {
        const slot = 1 - this.active;
        this.prepare(slot, 0);
        this.pending = slot;
        this.play(this.videos[slot]!);
      }
    }, 30000);
  }
  dispose() {
    this.disposed = true;
    this.running = false;
    clearInterval(this.watchdog);
    clearTimeout(this.cooldown);
    this.cleanups.forEach((fn) => fn());
    [...this.videos, this.music].forEach((m) => {
      this.cancel(m);
      m.onloadedmetadata = null;
      m.pause();
      m.removeAttribute("src");
      m.load();
    });
  }
}
