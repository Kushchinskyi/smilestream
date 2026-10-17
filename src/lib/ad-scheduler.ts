import type { Video } from "./backend";
export type Advertisement = Video & { original_sound: boolean };
export type AdSettings = { enabled: boolean; interval_minutes: number; block_count: number };
export type AdConfiguration = { settings: AdSettings; advertisements: Advertisement[] };
export const DEFAULT_ADS: AdSettings = { enabled: false, interval_minutes: 30, block_count: 1 };
export function validateAdSettings(value: AdSettings): AdSettings {
  if (
    typeof value.enabled !== "boolean" ||
    ![15, 20, 30, 45, 60].includes(value.interval_minutes) ||
    ![0, 1, 2, 3].includes(value.block_count)
  )
    throw new Error("Некоректні налаштування реклами");
  return {
    enabled: value.enabled,
    interval_minutes: value.interval_minutes,
    block_count: value.block_count,
  };
}
// Pure per-device clock. No persistent debt, wall-clock deadlines or concurrent timers.
export class AdScheduler {
  private configuration: AdConfiguration = { settings: DEFAULT_ADS, advertisements: [] };
  private elapsed = 0;
  private lastId: string | undefined;
  private inBlock = false;
  constructor(private intervalOverrideMs = 0) {}
  get enabled() {
    return this.configuration.settings.enabled;
  }
  update(configuration: AdConfiguration) {
    const settings = validateAdSettings(configuration.settings);
    if (configuration.advertisements.length > 1000)
      throw new Error("Рекламна бібліотека перевищує ліміт 1000");
    if (JSON.stringify(settings) !== JSON.stringify(this.configuration.settings)) this.elapsed = 0;
    this.configuration = {
      settings,
      advertisements: configuration.advertisements.filter((a) => a.is_active),
    };
  }
  tick(milliseconds: number, eligible: boolean) {
    if (!eligible || !this.configuration.advertisements.length) this.elapsed = 0;
    else if (!this.inBlock && this.enabled)
      this.elapsed += Math.max(0, Math.min(milliseconds, 5000));
  }
  peekBlock(): Advertisement[] {
    const { settings, advertisements: ads } = this.configuration;
    if (
      this.inBlock ||
      !settings.enabled ||
      !ads.length ||
      this.elapsed < (this.intervalOverrideMs || settings.interval_minutes * 60000)
    )
      return [];
    const start = (ads.findIndex((a) => a.id === this.lastId) + 1) % ads.length;
    const count =
      settings.block_count === 0 ? ads.length : Math.min(settings.block_count, ads.length);
    const block = Array.from({ length: count }, (_, i) => ads[(start + i) % ads.length]!);
    return block;
  }
  takeBlock(): Advertisement[] {
    const block = this.peekBlock();
    if (block.length) {
      this.elapsed = 0;
      this.inBlock = true;
      this.lastId = block[block.length - 1]!.id;
    }
    return block;
  }
  finish() {
    this.inBlock = false;
    this.elapsed = 0;
  }
}
