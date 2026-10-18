import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { musicLicenseView, type MusicLicenseEntry } from "@/lib/music-licenses";
const fixture: MusicLicenseEntry = {
  id: "fixture",
  title: "Fixture recording",
  performer: "Fixture author",
  productionUrl: "https://example.org/recording.mp3",
  sourceUrl: "https://example.org/source",
  cc0EvidenceUrl: "https://example.org/source",
  checkedAt: "2026-10-18",
  compositionStatus: "Publisher CC0",
  performanceStatus: "Publisher declaration",
  recordingStatus: "Exact MP3 hash retained",
  archiveUrl: "/music-license-evidence/fixture.json",
};
const mocks = vi.hoisted(() => ({
  accept: null as null | ((audio: { musicUrls: string[] }) => void),
  failure: null as null | (() => void),
  stop: vi.fn(),
}));
vi.mock("@/components/SiteHeader", () => ({ SiteHeader: () => <header>Smile Stream</header> }));
vi.mock("@/lib/backend", () => ({ backendConfigured: true }));
vi.mock("@/lib/playback-api", () => ({ fetchAudio: vi.fn() }));
vi.mock("@/lib/playback-sync", () => ({
  startPolling: (_read: unknown, accept: typeof mocks.accept, fail: typeof mocks.failure) => {
    mocks.accept = accept;
    mocks.failure = fail;
    return mocks.stop;
  },
}));
vi.mock("@/data/music-licenses", async () => ({
  MUSIC_LICENSES: [
    {
      id: "fixture",
      title: "Fixture recording",
      performer: "Fixture author",
      productionUrl: "https://example.org/recording.mp3",
      sourceUrl: "https://example.org/source",
      cc0EvidenceUrl: "https://example.org/source",
      checkedAt: "2026-10-18",
      compositionStatus: "Publisher CC0",
      performanceStatus: "Publisher declaration",
      recordingStatus: "Exact MP3 hash retained",
      archiveUrl: "/music-license-evidence/fixture.json",
    },
  ],
}));
import { MusicLicensesPage } from "@/components/MusicLicensesPage";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.accept = null;
  mocks.failure = null;
});
afterEach(cleanup);
it("never lists downloaded candidates, removed URLs or duplicate recordings as imported", () => {
  expect(musicLicenseView([], [fixture]).tracks).toEqual([]);
  expect(
    musicLicenseView([fixture.productionUrl, fixture.productionUrl], [fixture, fixture]),
  ).toEqual({
    tracks: [fixture],
    unregistered: 0,
    total: 1,
  });
  expect(musicLicenseView(["https://example.org/unknown.mp3"], [fixture])).toEqual({
    tracks: [],
    unregistered: 1,
    total: 1,
  });
});
it("distinguishes loading, empty import, actual import and live removal", () => {
  render(<MusicLicensesPage />);
  expect(screen.getByRole("status")).toHaveTextContent("Перевіряємо");
  act(() => mocks.accept!({ musicUrls: [] }));
  expect(screen.getByRole("status")).toHaveTextContent("не імпортовані");
  expect(screen.queryByText(fixture.title)).toBeNull();
  act(() => mocks.accept!({ musicUrls: [fixture.productionUrl] }));
  expect(screen.getByRole("heading", { name: fixture.title })).toBeVisible();
  expect(screen.getByRole("link", { name: "Заява CC0 для цього запису" })).toHaveAttribute(
    "href",
    fixture.cc0EvidenceUrl,
  );
  act(() => mocks.accept!({ musicUrls: [] }));
  expect(screen.queryByText(fixture.title)).toBeNull();
});
it("does not claim an empty or legally cleared catalogue on failure; recovers and cleans up", () => {
  const view = render(<MusicLicensesPage />);
  act(() => mocks.failure!());
  expect(screen.getByRole("status")).toHaveTextContent("не означає, що вона порожня");
  act(() =>
    mocks.accept!({ musicUrls: [fixture.productionUrl, "https://example.org/unknown.mp3"] }),
  );
  expect(screen.getByText(/не позначаємо їх як перевірені CC0/)).toBeVisible();
  act(() => mocks.failure!());
  expect(screen.getByRole("status")).toHaveTextContent("застарілим");
  expect(screen.getByText(fixture.title)).toBeVisible();
  view.unmount();
  expect(mocks.stop).toHaveBeenCalledOnce();
});
