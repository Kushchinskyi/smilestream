import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { fetchAudio, fetchVideos, writeAudio } from "@/lib/playback-api";
import { DEFAULT_AUDIO } from "@/lib/audio-settings";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));

describe("Supabase playback API", () => {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    abortSignal: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };
  beforeEach(() => {
    vi.clearAllMocks();
    query.abortSignal.mockReturnThis();
    vi.mocked(supabase.from).mockReturnValue(query as unknown as ReturnType<typeof supabase.from>);
  });
  afterEach(() => vi.useRealTimers());
  it("maps central settings and reads only singleton 1", async () => {
    query.single.mockResolvedValue({
      data: {
        id: 1,
        music_urls: ["https://example.com/a.mp3"],
        music_volume: 0.8,
        video_volume: 0.6,
        duck_volume: 0.1,
        original_video_ids: ["00000000-0000-4000-8000-000000000001"],
      },
      error: null,
    });
    expect(await fetchAudio(new AbortController().signal)).toEqual({
      musicUrls: ["https://example.com/a.mp3"],
      musicVolume: 0.8,
      videoVolume: 0.6,
      duckVolume: 0.1,
      originalIds: ["00000000-0000-4000-8000-000000000001"],
    });
    expect(supabase.from).toHaveBeenCalledWith("playback_settings");
    expect(query.eq).toHaveBeenCalledWith("id", 1);
    expect(query.update).not.toHaveBeenCalled();
  });
  it("does not turn a missing migration or denied read into default settings", async () => {
    query.single.mockResolvedValue({ data: null, error: new Error("missing table") });
    await expect(fetchAudio(new AbortController().signal)).rejects.toThrow("missing table");
  });
  it("updates only settings and requires a returned row to confirm saving", async () => {
    query.single
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: 1 }, error: null });
    await expect(writeAudio(DEFAULT_AUDIO)).rejects.toThrow();
    await expect(writeAudio(DEFAULT_AUDIO)).resolves.toEqual(DEFAULT_AUDIO);
    expect(supabase.from).toHaveBeenCalledWith("playback_settings");
    expect(query.update).toHaveBeenCalledWith({
      music_urls: [],
      music_volume: 0.35,
      video_volume: 1,
      duck_volume: 0.15,
      original_video_ids: [],
    });
  });
  it("reads active playlist in existing sort order and propagates errors", async () => {
    query.abortSignal
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: null, error: new Error("offline") });
    expect(await fetchVideos(new AbortController().signal)).toEqual([]);
    await expect(fetchVideos(new AbortController().signal)).rejects.toThrow("offline");
    expect(query.eq).toHaveBeenCalledWith("is_active", true);
    expect(query.order).toHaveBeenCalledWith("sort_order");
    expect(query.update).not.toHaveBeenCalled();
  });
  it("rejects invalid settings before making any Supabase request", async () => {
    await expect(writeAudio({ ...DEFAULT_AUDIO, musicUrls: ["https://"] })).rejects.toThrow();
    await expect(writeAudio({ ...DEFAULT_AUDIO, originalIds: ["demo-1"] })).rejects.toThrow();
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
