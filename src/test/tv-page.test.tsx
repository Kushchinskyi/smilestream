import { act, createElement, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "@/routes/tv";
import { fetchAudio, fetchVideos } from "@/lib/playback-api";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/lib/backend", () => ({ backendConfigured: true }));
vi.mock("@/lib/playback-api", () => ({ fetchAudio: vi.fn(), fetchVideos: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: vi.fn() } } }));

describe("public TV page with missing settings migration", () => {
  let container: HTMLDivElement, root: Root;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.mocked(fetchAudio).mockRejectedValue(new Error("42P01: playback_settings does not exist"));
    vi.mocked(fetchVideos).mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000001",
        title: "Isolated video fixture",
        url: "https://example.invalid/fixture.mp4",
        duration_seconds: 10,
        sort_order: 1,
        is_active: true,
        is_test: true,
      },
    ]);
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  async function mount() {
    await act(async () => root.render(createElement(Route.options.component as ComponentType)));
  }
  async function key(key: string) {
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    });
  }
  it("starts video without login and continues playlist polling when settings are unavailable", async () => {
    await mount();
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
    expect(container.querySelectorAll("video")).toHaveLength(2);
    expect(container.querySelector("video")?.getAttribute("src")).toBe(
      "https://example.invalid/fixture.mp4",
    );
    expect(container.textContent).toContain("звук");
    await act(async () => {
      container.querySelector("button")!.click();
    });
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(fetchVideos).toHaveBeenCalledTimes(2);
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
  });
  it("moves focus with remote arrows and recovers focus when controls were hidden", async () => {
    await mount();
    const start = container.querySelector("button")!;
    start.focus();
    await key("ArrowRight");
    expect(document.activeElement).toBe(container.querySelectorAll("button")[1]);
    await key("ArrowLeft");
    expect(document.activeElement).toBe(start);
    await act(async () => {
      start.click();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(container.querySelector("button")).toBeNull();
    await key("ArrowDown");
    expect(document.activeElement).toBe(container.querySelector("button"));
    await key("ArrowRight");
    expect(document.activeElement).toBe(container.querySelectorAll("button")[1]);
  });
});
