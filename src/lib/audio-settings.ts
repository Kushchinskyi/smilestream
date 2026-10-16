export type AudioSettings = {
  musicUrls: string[];
  musicVolume: number;
  videoVolume: number;
  duckVolume: number;
  originalIds: string[];
};
export const AUDIO_KEY = "smilestream.audio.v1";
export const DEFAULT_AUDIO: AudioSettings = {
  musicUrls: [],
  musicVolume: 0.35,
  videoVolume: 1,
  duckVolume: 0.15,
  originalIds: [],
};
export function parseAudio(value: unknown): AudioSettings {
  const x = (value || {}) as Partial<AudioSettings>;
  const volume = (n: unknown, fallback: number) =>
    typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
  return {
    musicUrls: Array.isArray(x.musicUrls)
      ? x.musicUrls.filter((s): s is string => typeof s === "string" && /^https:\/\//i.test(s))
      : [],
    originalIds: Array.isArray(x.originalIds)
      ? x.originalIds.filter((s): s is string => typeof s === "string")
      : [],
    musicVolume: volume(x.musicVolume, DEFAULT_AUDIO.musicVolume),
    videoVolume: volume(x.videoVolume, DEFAULT_AUDIO.videoVolume),
    duckVolume: volume(x.duckVolume, DEFAULT_AUDIO.duckVolume),
  };
}
export function readAudio(): AudioSettings {
  try {
    return parseAudio(JSON.parse(localStorage.getItem(AUDIO_KEY) || "null"));
  } catch {
    return { ...DEFAULT_AUDIO };
  }
}
