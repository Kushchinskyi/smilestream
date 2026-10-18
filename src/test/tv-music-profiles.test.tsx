import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DEFAULT_AUDIO } from "@/lib/audio-settings";
import { PROFILE_KEY, type MusicProfile } from "@/lib/music-profiles";
const mocks = vi.hoisted(() => ({
  accept: new Map<unknown, (value: unknown) => void>(),
  start: vi.fn(),
  resume: vi.fn(),
  settings: vi.fn(),
  playlist: vi.fn(),
  dispose: vi.fn(),
  ads: vi.fn(),
}));
vi.mock("@/lib/backend", () => ({ backendConfigured: true }));
vi.mock("@/lib/playback-api", () => ({ fetchVideos: vi.fn(), fetchAudio: vi.fn() }));
vi.mock("@/lib/music-profile-api", () => ({ fetchMusicProfiles: vi.fn() }));
vi.mock("@/lib/ad-api", () => ({ fetchAdvertisements: vi.fn() }));
vi.mock("@/lib/playback-sync", () => ({
  startPolling: (read: unknown, accept: (value: unknown) => void) => {
    mocks.accept.set(read, accept);
    return vi.fn();
  },
}));
vi.mock("@/lib/tv-playback", () => ({
  TvPlayback: class {
    updateSettings = mocks.settings;
    updatePlaylist = mocks.playlist;
    updateAdvertisements = mocks.ads;
    start = mocks.start;
    resume = mocks.resume;
    dispose = mocks.dispose;
  },
}));
import { Route } from "@/routes/tv";
import { fetchAudio, fetchVideos } from "@/lib/playback-api";
import { fetchMusicProfiles } from "@/lib/music-profile-api";
const Tv = Route.options.component!;
const p: MusicProfile = {
  id: "b1000000-0000-4000-8000-000000000001",
  name: "Piano",
  description: "",
  is_active: true,
  is_default: true,
  sort_order: 1,
  volume_override: null,
  track_urls: ["https://example.com/a.mp3"],
};
function feed(read: unknown, value: unknown) {
  act(() => mocks.accept.get(read)!(value));
}
function setup(profiles = [p]) {
  render(<Tv />);
  feed(fetchVideos, [{ id: "video", url: "https://example.com/a.mp4" }]);
  feed(fetchAudio, { ...DEFAULT_AUDIO, musicUrls: p.track_urls });
  feed(fetchMusicProfiles, profiles);
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.accept.clear();
  localStorage.clear();
});
afterEach(cleanup);
it("seven profiles, no-music and back form a remote-navigable three-column picker", () => {
  const rows = Array.from({ length: 7 }, (_, i) => ({
    ...p,
    id: `b1000000-0000-4000-8000-00000000000${i + 1}`,
    name: `Profile ${i + 1}`,
    is_default: i === 0,
  }));
  setup(rows);
  fireEvent.click(screen.getByRole("button", { name: /Дивитися/ }));
  const grid = screen.getByRole("group", { name: "Музичні профілі" });
  expect(grid.querySelectorAll("button")).toHaveLength(9);
  fireEvent.keyDown(window, { key: "ArrowDown" });
  expect(screen.getByRole("button", { name: "Profile 4" })).toHaveFocus();
  fireEvent.keyDown(window, { key: "ArrowRight" });
  expect(screen.getByRole("button", { name: "Profile 5" })).toHaveFocus();
  fireEvent.keyDown(window, { key: "ArrowDown" });
  expect(screen.getByRole("button", { name: "Без музики" })).toHaveFocus();
  fireEvent.click(document.activeElement!);
  expect(localStorage.getItem(PROFILE_KEY)).toBe("none");
  expect(mocks.start).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Музичний профіль" }));
  expect(screen.getByRole("button", { name: /Без музики/ })).toHaveFocus();
  feed(
    fetchMusicProfiles,
    rows.map((r) => ({ ...r })),
  );
  expect(screen.getByRole("button", { name: /Без музики/ })).toHaveFocus();
  expect(mocks.start).toHaveBeenCalledOnce();
});
it("patient picker shows only names, selection and navigation, without licence or count metadata", () => {
  setup([{ ...p, description: "15 перевірених записів · CC0 · технічні дані" }]);
  expect(screen.queryByText(/Jason Shaw/)).toBeNull();
  expect(screen.queryByRole("button", { name: /ліцензії/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Дивитися/ }));
  expect(screen.getByRole("button", { name: /^Piano/ })).toBeVisible();
  expect(screen.queryByText(/15 перевірених/)).toBeNull();
  expect(screen.queryByText(/За замовчуванням/)).toBeNull();
  expect(screen.queryByText(/Без фонових треків/)).toBeNull();
  expect(mocks.start).not.toHaveBeenCalled();
});
it("Watch opens picker; Samsung arrows/OK navigate, selection starts existing engine", () => {
  setup();
  fireEvent.click(screen.getByRole("button", { name: /Дивитися/ }));
  const first = screen.getByRole("button", { name: /Piano/ });
  expect(first).toHaveFocus();
  fireEvent.keyDown(window, { keyCode: 39 });
  expect(screen.getByRole("button", { name: /Без музики/ })).toHaveFocus();
  fireEvent.click(document.activeElement!);
  expect(mocks.start).toHaveBeenCalledWith(true);
  expect(mocks.settings.mock.lastCall?.[0].musicUrls).toEqual([]);
  expect(localStorage.getItem(PROFILE_KEY)).toBe("none");
});
it("profile switch and settings changes never restart video or rebuild the engine", () => {
  setup();
  fireEvent.click(screen.getByRole("button", { name: /Дивитися/ }));
  fireEvent.click(screen.getByRole("button", { name: /Piano/ }));
  fireEvent.click(screen.getByRole("button", { name: "Музичний профіль" }));
  fireEvent.click(screen.getByRole("button", { name: /Без музики/ }));
  feed(fetchAudio, { ...DEFAULT_AUDIO, musicVolume: 0.8, musicUrls: p.track_urls });
  expect(mocks.start).toHaveBeenCalledTimes(1);
  expect(mocks.resume).toHaveBeenCalledOnce();
  expect(mocks.settings.mock.lastCall?.[0].musicUrls).toEqual([]);
});
it("remembered nondefault survives audio arriving before profile snapshot", () => {
  const other = {
    ...p,
    id: "b1000000-0000-4000-8000-000000000002",
    name: "Ambient",
    is_default: false,
    track_urls: [],
  };
  localStorage.setItem(PROFILE_KEY, other.id);
  setup([p, other]);
  fireEvent.click(screen.getByRole("button", { name: /Дивитися/ }));
  expect(screen.getByRole("button", { name: /Ambient/ })).toHaveAttribute("aria-pressed", "true");
});
it("deleted selection falls back to default and empty selection remains silent", () => {
  setup();
  fireEvent.click(screen.getByRole("button", { name: /Дивитися/ }));
  fireEvent.click(screen.getByRole("button", { name: /Piano/ }));
  const next = { ...p, id: "b1000000-0000-4000-8000-000000000002", track_urls: [] };
  feed(fetchMusicProfiles, [next]);
  expect(mocks.settings.mock.lastCall?.[0].musicUrls).toEqual([]);
  expect(mocks.start).toHaveBeenCalledTimes(1);
});
it("central library removal silences a remembered profile before profile polling catches up", () => {
  localStorage.setItem(PROFILE_KEY, p.id);
  setup();
  fireEvent.click(screen.getByRole("button", { name: /Дивитися/ }));
  fireEvent.click(screen.getByRole("button", { name: /Piano/ }));
  expect(mocks.settings.mock.lastCall?.[0].musicUrls).toEqual(p.track_urls);
  const starts = mocks.start.mock.calls.length;
  feed(fetchAudio, { ...DEFAULT_AUDIO, musicUrls: [] });
  expect(mocks.settings.mock.lastCall?.[0].musicUrls).toEqual([]);
  // An old profile response cannot resurrect URLs removed from the central library.
  feed(fetchMusicProfiles, [p]);
  expect(mocks.settings.mock.lastCall?.[0].musicUrls).toEqual([]);
  feed(fetchMusicProfiles, [{ ...p, track_urls: [] }]);
  expect(mocks.settings.mock.lastCall?.[0].musicUrls).toEqual([]);
  expect(mocks.start).toHaveBeenCalledTimes(starts);
  expect(mocks.dispose).not.toHaveBeenCalled();
});
