import type { Video } from "../../src/lib/backend";
import type { AudioSettings } from "../../src/lib/audio-settings";
// Public testing files: https://samplelib.com/sample-mp4.html and /sample-mp3.html.
// Never imported by the application or its normal Vite configuration.
export const playlist: Video[] = [5, 10, 15].map((seconds, i) => ({
  id: `00000000-0000-4000-8000-00000000000${i + 1}`,
  title: `LOCAL TEST ${i + 1} · ${seconds}s${i === 1 ? " · original audio" : ""}`,
  url: `https://samplelib.com/mp4/sample-${seconds}s-360p.mp4`,
  duration_seconds: seconds,
  sort_order: i,
  is_active: true,
  is_test: true,
}));
export const audioSettings: AudioSettings = {
  musicUrls: ["https://samplelib.com/mp3/sample-20s.mp3"],
  musicVolume: 0.35,
  videoVolume: 0.7,
  duckVolume: 0.2,
  originalIds: [playlist[1]!.id],
};
export function localMediaHost(host: string) {
  if (["localhost", "127.0.0.1", "[::1]"].includes(host)) return true;
  const octets = host.split(".");
  if (octets.length !== 4 || !octets.every((x) => /^\d{1,3}$/.test(x) && Number(x) <= 255))
    return false;
  const [a, b] = octets.map(Number);
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b! >= 16 && b! <= 31);
}
