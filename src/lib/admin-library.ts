import type { Video } from "./backend";
import { isMusicUrl, validateAudio, type AudioSettings } from "./audio-settings";
export const CATEGORIES = {
  digital: "Цифрова стоматологія",
  cadcam: "CAD/CAM",
  printing: "3D-друк",
  implants: "Імплантація",
  prosthetics: "Протезування",
  orthodontics: "Ортодонтія",
  hygiene: "Гігієна",
  sterilization: "Стерилізація",
  other: "Інше",
};
export type MediaMetadata = {
  kind: string;
  source_key: string;
  label: string;
  category: string;
  cover_url?: string;
};
export function formatCycleDuration(seconds: number) {
  const value = Math.max(0, Math.floor(seconds)),
    hours = Math.floor(value / 3600),
    minutes = Math.floor((value % 3600) / 60);
  return [hours ? `${hours} год` : "", minutes ? `${minutes} хв` : "", `${value % 60} с`]
    .filter(Boolean)
    .join(" ");
}
export function validateVideo<
  T extends {
    title: string;
    url: string;
    duration_seconds: number;
    sort_order: number;
  },
>(v: T) {
  if (!v.title.trim() || v.title.trim().length > 200)
    throw new Error("Назва: від 1 до 200 символів");
  if (!isMusicUrl(v.url)) throw new Error("Потрібне пряме HTTPS-посилання без логіна чи пароля");
  if (!Number.isInteger(v.duration_seconds) || v.duration_seconds < 0 || v.duration_seconds > 86400)
    throw new Error("Тривалість: від 0 до 86400 секунд");
  if (!Number.isSafeInteger(v.sort_order) || Math.abs(v.sort_order) > 1000000)
    throw new Error("Некоректний порядок");
  return { ...v, title: v.title.trim(), url: v.url.trim() };
}
export function selectVideos(
  videos: Video[],
  query: string,
  active: string,
  category: string,
  metadata: MediaMetadata[],
) {
  const categories = new Map(
    metadata.filter((m) => m.kind === "video").map((m) => [m.source_key, m.category]),
  );
  return videos.filter(
    (v) =>
      v.title.toLocaleLowerCase("uk").includes(query.toLocaleLowerCase("uk")) &&
      (active === "all" || v.is_active === (active === "active")) &&
      (category === "all" || (categories.get(v.id) || "other") === category),
  );
}
export function exportLibrary(videos: Video[], audio: AudioSettings, metadata: MediaMetadata[]) {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    videos: videos.map((v) => ({
      id: v.id,
      title: v.title,
      url: v.url,
      duration_seconds: v.duration_seconds,
      sort_order: v.sort_order,
      is_active: v.is_active,
      is_test: v.is_test,
    })),
    audio: validateAudio(audio),
    metadata: metadata.map((m) => ({
      kind: m.kind,
      source_key: m.source_key,
      label: m.label,
      category: m.category,
      cover_url: m.cover_url || "",
    })),
  };
}
export function parseAudioImport(text: string) {
  if (new Blob([text]).size > 2 * 1024 * 1024) throw new Error("Файл перевищує 2 МБ");
  const value: unknown = JSON.parse(text);
  const obj = value as { version?: unknown; audio?: unknown };
  return validateAudio(obj?.version === 1 ? obj.audio : value);
}
export function downloadJson(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
