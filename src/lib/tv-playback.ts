import type { Video } from "./backend";
import { DEFAULT_AUDIO, parseAudio, type AudioSettings } from "./audio-settings";

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
  private progress = new Map<HTMLMediaElement, { time: number; at: number }>();
  private attempts = new Map<HTMLMediaElement, number>();
  private timers = new Map<HTMLMediaElement, ReturnType<typeof setTimeout>>();
  private cleanups: (() => void)[] = [];
  private watchdog: ReturnType<typeof setInterval>;
  constructor(
    private videos: HTMLVideoElement[],
    private music: HTMLAudioElement,
    private items: Video[],
    private report: (message: string, blocked?: boolean) => void,
  ) {
    this.current = items[0] || null;
    videos.forEach((v, slot) => {
      v.muted = true;
      v.preload = "auto";
      v.playsInline = true;
      v.setAttribute("webkit-playsinline", "");
      this.listen(v, "ended", () => {
        if (slot === this.active && this.pending === null) this.next();
      });
      this.listen(v, "playing", () => {
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
          this.prepare(1 - slot, (this.index + 1) % this.items.length);
          if (this.queued !== null) {
            const queued = this.queued;
            this.queued = null;
            this.updatePlaylist(queued);
          }
        }
        if (slot === this.active) {
          this.report(this.current?.title || "");
          this.mix();
        }
      });
      this.listen(v, "error", () => {
        if (this.running && (slot === this.active || slot === this.pending)) this.recover(v);
      });
      this.listen(v, "pause", () => this.mix());
      this.listen(v, "waiting", () => {
        if (slot === this.active) this.mix(true);
      });
    });
    this.listen(music, "ended", () => this.nextMusic());
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
      if (!document.hidden && this.running) this.resume();
    };
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visible);
    this.cleanups.push(() => {
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visible);
    });
    this.watchdog = setInterval(() => {
      if (!this.running || document.hidden) return;
      [this.videos[this.pending ?? this.active]!, music].forEach((m) => {
        if (!m.getAttribute("src") || (m === music && !this.sound)) return;
        if (m !== music && m.ended && !this.items.length) return;
        const p = this.progress.get(m);
        if (!p || m.currentTime !== p.time) {
          this.progress.set(m, { time: m.currentTime, at: Date.now() });
          if (p && m.currentTime !== p.time) this.attempts.set(m, 0);
        } else if (Date.now() - p.at > 15000) this.recover(m);
      });
    }, 3000);
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
    if (this.pending !== null) {
      this.queued = items;
      return;
    }
    if (JSON.stringify(items) === JSON.stringify(this.items)) return;
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
      if (this.running && this.videos[this.active]!.ended) this.next();
    }
  }
  private listen(m: HTMLMediaElement, name: string, fn: () => void) {
    m.addEventListener(name, fn);
    this.cleanups.push(() => m.removeEventListener(name, fn));
  }
  private prepare(slot: number, index: number) {
    const v = this.videos[slot]!,
      item = this.items[index];
    if (!item) return;
    this.cancel(v);
    v.onloadedmetadata = null;
    v.pause();
    v.muted = true;
    v.dataset["index"] = String(index);
    v.src = item.url;
    v.load();
    this.progress.delete(v);
  }
  private play(m: HTMLMediaElement) {
    if (this.disposed) return;
    try {
      const promise = m.play();
      if (promise && promise.catch)
        promise.catch((e: { name?: string }) => {
          if (this.disposed || e.name === "AbortError") return;
          if (e.name === "NotAllowedError") {
            this.report("Натисніть «Продовжити» для запуску звуку та відео", true);
            this.running = false;
            this.music.pause();
            this.videos.forEach((v) => v.pause());
          } else this.recover(m);
        });
    } catch {
      this.recover(m);
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
    this.play(this.videos[this.pending ?? this.active]!);
    this.loadMusic();
  }
  resume() {
    this.running = true;
    const v = this.videos[this.pending ?? this.active]!;
    if (v.error) v.load();
    this.mix();
    if (v.getAttribute("src") && !(v.ended && !this.items.length)) this.play(v);
    if (this.sound && this.settings.musicUrls.length) this.play(this.music);
  }
  next() {
    if (!this.items.length || this.pending !== null) {
      this.mix(true);
      return;
    }
    const slot = 1 - this.active,
      v = this.videos[slot]!;
    const index = (this.index + 1) % this.items.length;
    this.cancel(v);
    this.cancel(this.videos[this.active]!);
    if (Number(v.dataset["index"]) !== index || v.error) this.prepare(slot, index);
    this.pending = slot;
    // Incoming stays muted until playing, so two video soundtracks never overlap.
    this.play(v);
  }
  toggleSound() {
    this.sound = !this.sound;
    this.mix();
    if (this.sound) this.loadMusic();
    else this.music.pause();
  }
  private mix(waiting = false) {
    const v = this.videos[this.active]!;
    const original = this.settings.originalIds.includes(this.current?.id || "");
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
      this.music.pause();
      this.music.removeAttribute("src");
      this.music.load();
      return;
    }
    if (this.music.getAttribute("src") !== url) {
      this.music.src = url;
      this.music.load();
      this.progress.delete(this.music);
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
    const attempt = (this.attempts.get(m) || 0) + 1;
    this.attempts.set(m, attempt);
    this.report(m === this.music ? "Відновлення музики…" : "Відновлення відео…");
    this.timers.set(
      m,
      setTimeout(
        () => {
          this.timers.delete(m);
          if (!this.running || this.disposed) return;
          this.progress.delete(m);
          if (attempt > 2) {
            if (m === this.music) this.nextMusic();
            else if (this.pending !== null) {
              const slot = this.pending;
              const next = (Number(m.dataset["index"]) + 1) % this.items.length;
              this.prepare(slot, next);
              this.play(m);
            } else this.next();
          } else {
            const position = m.currentTime;
            m.load();
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
            };
            this.play(m);
          }
        },
        Math.min(30000, 1000 * Math.pow(2, Math.min(attempt, 5))),
      ),
    );
  }
  dispose() {
    this.disposed = true;
    this.running = false;
    clearInterval(this.watchdog);
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
