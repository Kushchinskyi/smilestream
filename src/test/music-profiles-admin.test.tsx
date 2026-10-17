import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ fetch: vi.fn(), save: vi.fn(), remove: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/music-profile-api", () => ({
  fetchMusicProfiles: api.fetch,
  saveMusicProfile: api.save,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: api.rpc,
    from: () => ({ delete: () => ({ eq: () => ({ select: () => ({ single: api.remove }) }) }) }),
  },
}));
vi.mock("@/hooks/use-unsaved", () => ({ useUnsaved: vi.fn() }));
import { MusicProfilesPanel } from "@/components/MusicProfilesPanel";
const p = {
  id: "b1000000-0000-4000-8000-000000000001",
  name: "Piano",
  description: "",
  is_active: true,
  is_default: true,
  sort_order: 1,
  volume_override: null,
  track_urls: [],
};
beforeEach(() => {
  vi.clearAllMocks();
  api.fetch.mockResolvedValue([p]);
  api.save.mockResolvedValue(undefined);
  api.remove.mockResolvedValue({ error: null });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(window, "confirm").mockReturnValue(false);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function mount() {
  render(<MusicProfilesPanel library={[]} labels={{}} volume={0.35} onDirtyChange={() => {}} />);
}
it("disabling a default clears both active and default flags", async () => {
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Вимкнути Piano" }));
  await waitFor(() =>
    expect(api.save).toHaveBeenCalledWith({ ...p, is_active: false, is_default: false }),
  );
});
it("deletion requires confirmation and leaves library settings untouched", async () => {
  mount();
  const button = await screen.findByRole("button", { name: "Видалити Piano" });
  fireEvent.click(button);
  expect(api.remove).not.toHaveBeenCalled();
  vi.mocked(window.confirm).mockReturnValue(true);
  fireEvent.click(button);
  await waitFor(() => expect(api.remove).toHaveBeenCalledOnce());
  expect(api.save).not.toHaveBeenCalled();
});
it("empty profile editor can be saved without creating tracks", async () => {
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Редагувати Piano" }));
  fireEvent.change(screen.getByLabelText("Назва"), { target: { value: "Quiet room" } });
  fireEvent.click(screen.getByRole("button", { name: "Зберегти профіль" }));
  await waitFor(() => expect(api.save).toHaveBeenCalledWith({ ...p, name: "Quiet room" }));
});
