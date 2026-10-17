import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { selectVideos, validateVideo, exportLibrary, parseAudioImport } from "@/lib/admin-library";
import { formatCycleDuration } from "@/lib/admin-library";
import { MediaCover } from "@/components/MediaCover";
import { DEFAULT_AUDIO } from "@/lib/audio-settings";
import { VideoLibrary } from "@/components/VideoLibrary";
import { AudioSettingsPanel } from "@/components/AudioSettingsPanel";
import type { Video } from "@/lib/backend";
const videos: Video[] = Array.from({ length: 130 }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  title: `Відео ${i}`,
  url: `https://example.com/${i}.mp4`,
  duration_seconds: 15,
  sort_order: i,
  is_active: i % 2 === 0,
  is_test: true,
}));
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("admin library safety and UX", () => {
  it("formats explicit cycle duration and uses a fallback when cover fails", () => {
    expect(formatCycleDuration(5 + 10 + 15)).toBe("30 с");
    expect(formatCycleDuration(3665)).toBe("1 год 1 хв 5 с");
    const ui = render(<MediaCover url="https://example.com/cover.jpg" />);
    fireEvent.error(ui.container.querySelector("img")!);
    expect(ui.container.querySelector("img")).toBeNull();
    expect(ui.container.querySelector("svg")).not.toBeNull();
  });
  it("calculates ducking from current draft and explains zero video volume", () => {
    const props = {
      settings: { ...DEFAULT_AUDIO, musicVolume: 1, duckVolume: 0.25 },
      onChange: vi.fn(),
      labels: {},
      onLabels: vi.fn(),
      onSave: vi.fn(),
      saving: false,
      dirty: true,
      error: "",
    };
    const ui = render(<AudioSettingsPanel {...props} />);
    expect(screen.getByText(/Чернетка: музика 100% × приглушення 25% = 25%/)).toBeInTheDocument();
    ui.rerender(<AudioSettingsPanel {...props} settings={{ ...props.settings, videoVolume: 0 }} />);
    expect(
      screen.getByText(/оригінальний звук 0% — приглушення не діє, музика 100%/),
    ).toBeInTheDocument();
    ui.rerender(
      <AudioSettingsPanel
        {...props}
        dirty={false}
        settings={{ ...props.settings, musicVolume: 0, duckVolume: 1 }}
      />,
    );
    expect(
      screen.getByText(/Збережені значення: музика 0% × приглушення 100% = 0%/),
    ).toBeInTheDocument();
  });
  it("keeps advertisement inventory explicitly separate from TV broadcasting", () => {
    render(
      <VideoLibrary
        advertisement
        videos={[]}
        metadata={[]}
        originalIds={[]}
        busy={false}
        onEdit={vi.fn()}
        onPreview={vi.fn()}
        onActive={vi.fn()}
        onOriginal={vi.fn()}
        onReorder={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: /Рекламна бібліотека/ })).toBeInTheDocument();
    expect(screen.queryByLabelText("Категорія")).not.toBeInTheDocument();
    expect(screen.getByText(/ввімкніть рекламні блоки/)).toBeInTheDocument();
  });
  it("validates HTTPS, credentials, duration, title and preserves active flag", () => {
    const v = videos[0]!;
    expect(validateVideo(v).is_active).toBe(true);
    for (const url of [
      "http://example.com/a.mp4",
      "https://u:p@example.com/a.mp4",
      "javascript:alert(1)",
    ])
      expect(() => validateVideo({ ...v, url })).toThrow();
    for (const duration_seconds of [-1, NaN, 1.5, 86401])
      expect(() => validateVideo({ ...v, duration_seconds })).toThrow();
    expect(() => validateVideo({ ...v, title: " " })).toThrow();
  });
  it("filters categories, Ukrainian search and activity without mutating source order", () => {
    const meta = [{ kind: "video", source_key: videos[2]!.id, label: "", category: "digital" }];
    expect(selectVideos(videos, "ВІДЕО 2", "active", "digital", meta)).toEqual([videos[2]]);
    expect(videos[0]!.sort_order).toBe(0);
  });
  it("exports an explicit whitelist without arbitrary credentials or auth fields", () => {
    const v = { ...videos[0]!, adminPassword: "SECRET", token: "TOKEN" };
    const output = JSON.stringify(exportLibrary([v], { ...DEFAULT_AUDIO }, []));
    expect(output).not.toMatch(/SECRET|TOKEN|adminPassword/);
    expect(parseAudioImport(output)).toEqual(DEFAULT_AUDIO);
    expect(() =>
      parseAudioImport(JSON.stringify({ musicUrls: ["http://unsafe"], originalIds: [] })),
    ).toThrow();
  });
  it("paginates 130 videos and supports search/empty state and bulk selection", () => {
    const original = vi.fn();
    render(
      <VideoLibrary
        videos={videos}
        metadata={[]}
        originalIds={[]}
        busy={false}
        onEdit={vi.fn()}
        onPreview={vi.fn()}
        onActive={vi.fn()}
        onOriginal={original}
        onReorder={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("checkbox")).toHaveLength(26);
    fireEvent.click(screen.getByLabelText("Обрати сторінку"));
    fireEvent.click(screen.getByRole("button", { name: "Зі звуком" }));
    expect(original).toHaveBeenCalledWith(
      videos.slice(0, 25).map((v) => v.id),
      true,
    );
    fireEvent.change(screen.getByLabelText("Пошук відео"), { target: { value: "does not exist" } });
    expect(screen.getByText("Нічого не знайдено")).toBeInTheDocument();
  });
  it("edits volume as a draft, restores a muted channel and saves only explicitly", () => {
    const onChange = vi.fn(),
      onSave = vi.fn();
    const props = {
      settings: DEFAULT_AUDIO,
      onChange,
      labels: {},
      onLabels: vi.fn(),
      onSave,
      saving: false,
      dirty: true,
      error: "",
    };
    const ui = render(<AudioSettingsPanel {...props} />);
    fireEvent.change(screen.getByLabelText("Фонова музика"), { target: { value: "0" } });
    expect(onChange.mock.lastCall?.[0].musicVolume).toBe(0);
    expect(onSave).not.toHaveBeenCalled();
    ui.rerender(<AudioSettingsPanel {...props} settings={{ ...DEFAULT_AUDIO, musicVolume: 0 }} />);
    fireEvent.click(screen.getByText("Увімкнути канал"));
    expect(onChange.mock.lastCall?.[0].musicVolume).toBe(0.35);
    fireEvent.click(screen.getByRole("button", { name: "Зберегти звук" }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
