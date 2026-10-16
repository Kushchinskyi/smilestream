export type AudioSettings = {
  musicUrls: string[];
  musicVolume: number;
  videoVolume: number;
  duckVolume: number;
  originalIds: string[];
};
export const AUDIO_KEY = "smilestream.audio.v1";
export const MAX_MUSIC_URLS = 500;
export const MAX_ORIGINAL_IDS = 10000;
export const MAX_MUSIC_URL_LENGTH = 2048;
export function isMusicUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (
    !/^https:\/\//i.test(text) ||
    text.length > MAX_MUSIC_URL_LENGTH ||
    /\s/.test(text) ||
    text.includes("\\") ||
    Array.from(text).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
  )
    return false;
  try {
    const url = new URL(text);
    return url.protocol === "https:" && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}
export function isVideoId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}
// Strict validation for imports/writes. Never silently publish a partially filtered draft.
export function validateAudio(value: unknown): AudioSettings {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Некоректні налаштування звуку");
  const x = value as Partial<AudioSettings>;
  if (
    !Array.isArray(x.musicUrls) ||
    x.musicUrls.length > MAX_MUSIC_URLS ||
    !x.musicUrls.every(isMusicUrl)
  )
    throw new Error(
      `Музика: до ${MAX_MUSIC_URLS} коректних HTTPS URL без логіна/пароля, до ${MAX_MUSIC_URL_LENGTH} символів`,
    );
  if (
    !Array.isArray(x.originalIds) ||
    x.originalIds.length > MAX_ORIGINAL_IDS ||
    !x.originalIds.every(isVideoId)
  )
    throw new Error(`Оригінальний звук: до ${MAX_ORIGINAL_IDS} коректних UUID відео`);
  for (const key of ["musicVolume", "videoVolume", "duckVolume"] as const) {
    const n = x[key];
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1)
      throw new Error("Гучність має бути числом від 0 до 1");
  }
  return parseAudio(x);
}
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
      ? x.musicUrls
          .slice(0, MAX_MUSIC_URLS)
          .filter(isMusicUrl)
          .map((s) => s.trim())
      : [],
    originalIds: Array.isArray(x.originalIds)
      ? [
          ...new Set(
            x.originalIds
              .slice(0, MAX_ORIGINAL_IDS)
              .filter(isVideoId)
              .map((s) => s.toLowerCase()),
          ),
        ]
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
