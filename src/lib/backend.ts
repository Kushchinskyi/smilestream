// Whether the backend is configured. When false the app runs in explicit demo mode
// and never exposes admin operations.
export const backendConfigured = Boolean(
  import.meta.env['VITE_SUPABASE_URL'] && import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'],
);

export type Video = {
  id: string;
  title: string;
  url: string;
  duration_seconds: number;
  sort_order: number;
  is_active: boolean;
  is_test: boolean;
};

// Used only when the backend is unreachable/unconfigured. Clearly labelled as test content.
export const DEMO_PLAYLIST: Video[] = [
  {
    id: "demo-1",
    title: "ТЕСТ (демо) · Flower (MDN, CC0)",
    url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    duration_seconds: 6,
    sort_order: 1,
    is_active: true,
    is_test: true,
  },
  {
    id: "demo-2",
    title: "ТЕСТ (демо) · Big Buck Bunny 10s (Blender Foundation, CC BY)",
    url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp4",
    duration_seconds: 10,
    sort_order: 2,
    is_active: true,
    is_test: true,
  },
];

export function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? "0" : ""}${r}`;
}
