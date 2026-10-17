import { isMusicUrl, isVideoId, type AudioSettings } from "./audio-settings";
export type MusicProfile = {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
  volume_override: number | null;
  track_urls: string[];
};
export const NO_MUSIC = "none";
export const LEGACY_MUSIC = "library";
export const PROFILE_KEY = "smilestream.music-profile.v1";
export function validateProfile(value: MusicProfile): MusicProfile {
  if (
    !isVideoId(value.id) ||
    !value.name.trim() ||
    value.name.trim().length > 100 ||
    value.description.length > 500 ||
    !Number.isSafeInteger(value.sort_order) ||
    Math.abs(value.sort_order) > 1000000 ||
    typeof value.is_active !== "boolean" ||
    typeof value.is_default !== "boolean" ||
    (value.is_default && !value.is_active) ||
    (value.volume_override !== null &&
      (!Number.isFinite(value.volume_override) ||
        value.volume_override < 0 ||
        value.volume_override > 1)) ||
    !Array.isArray(value.track_urls) ||
    value.track_urls.length > 500 ||
    !value.track_urls.every(isMusicUrl) ||
    new Set(value.track_urls).size !== value.track_urls.length
  )
    throw new Error("Перевірте назву, гучність, активність і список композицій");
  return { ...value, name: value.name.trim() };
}
export function resolveProfile(profiles: MusicProfile[], selected: string | null): string {
  const active = profiles.filter((p) => p.is_active);
  if (selected === NO_MUSIC) return NO_MUSIC;
  if (active.some((p) => p.id === selected)) return selected!;
  return (
    active.find((p) => p.is_default)?.id ||
    active[0]?.id ||
    (selected && selected !== LEGACY_MUSIC ? NO_MUSIC : LEGACY_MUSIC)
  );
}
export function profileAudio(
  base: AudioSettings,
  profiles: MusicProfile[],
  selected: string | null,
): AudioSettings {
  const id = resolveProfile(profiles, selected),
    p = profiles.find((p) => p.id === id && p.is_active);
  return {
    ...base,
    musicUrls:
      id === NO_MUSIC
        ? []
        : p
          ? p.track_urls.filter((url) => base.musicUrls.includes(url))
          : base.musicUrls,
    musicVolume: p?.volume_override ?? base.musicVolume,
  };
}
export function readProfileChoice(): string | null {
  try {
    const id = localStorage.getItem(PROFILE_KEY);
    return id === NO_MUSIC || id === LEGACY_MUSIC || isVideoId(id) ? id : null;
  } catch {
    return null;
  }
}
export function rememberProfileChoice(id: string) {
  try {
    localStorage.setItem(PROFILE_KEY, id);
  } catch {
    /* Private mode: session selection still works. */
  }
}
