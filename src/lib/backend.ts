// Whether the backend is configured. When false the app runs in explicit demo mode
// and never exposes admin operations.
export const backendConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
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
    title: "ТЕСТ (демо) · Big Buck Bunny (Blender Foundation, CC BY)",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    duration_seconds: 596,
    sort_order: 1,
    is_active: true,
    is_test: true,
  },
  {
    id: "demo-2",
    title: "ТЕСТ (демо) · Sintel (Blender Foundation, CC BY)",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
    duration_seconds: 888,
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
