import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { AdSettingsPanel } from "@/components/AdSettingsPanel";
import { fetchAdSettings, writeAdSettings } from "@/lib/ad-api";
import { DEFAULT_ADS } from "@/lib/ad-scheduler";
vi.mock("@/lib/ad-api", () => ({ fetchAdSettings: vi.fn(), writeAdSettings: vi.fn() }));
beforeEach(() => {
  vi.mocked(fetchAdSettings).mockResolvedValue(DEFAULT_ADS);
  vi.mocked(writeAdSettings).mockImplementation(async (s) => s);
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("loads saved settings, keeps edits a draft, saves explicitly and never offers accelerated intervals", async () => {
  const dirty = vi.fn();
  render(<AdSettingsPanel onDirtyChange={dirty} />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Зберегти рекламу" })).toBeDisabled(),
  );
  await screen.findByText(/Збережено: Вимкнено/);
  expect(screen.getAllByRole("option").map((o) => o.getAttribute("value"))).not.toContain("60s");
  expect(
    Array.from(screen.getByLabelText("Інтервал").querySelectorAll("option")).map((o) => o.value),
  ).toEqual(["15", "20", "30", "45", "60"]);
  fireEvent.click(screen.getByLabelText("Увімкнути рекламу"));
  expect(writeAdSettings).not.toHaveBeenCalled();
  expect(screen.getByRole("status")).toHaveTextContent("Чернетка");
  fireEvent.click(screen.getByRole("button", { name: "Зберегти рекламу" }));
  await screen.findByText(/Збережено: Увімкнено/);
  expect(writeAdSettings).toHaveBeenCalledWith({ ...DEFAULT_ADS, enabled: true });
  expect(dirty).toHaveBeenLastCalledWith(false);
  expect(screen.getByText(/Дані недоступні/)).toBeInTheDocument();
});
it("shows failed reads without invented saved state and supports retry", async () => {
  vi.mocked(fetchAdSettings).mockRejectedValueOnce(new Error("network"));
  render(<AdSettingsPanel />);
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Увімкнути рекламу")).toBeDisabled();
  expect(screen.queryByText(/Збережено: Вимкнено/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Повторити" }));
  await screen.findByText(/Збережено: Вимкнено/);
});
it("preserves draft after failed save and never reports false success", async () => {
  vi.mocked(writeAdSettings).mockRejectedValue(new Error("RLS"));
  render(<AdSettingsPanel />);
  await screen.findByText(/Збережено: Вимкнено/);
  fireEvent.click(screen.getByLabelText("Увімкнути рекламу"));
  fireEvent.click(screen.getByRole("button", { name: "Зберегти рекламу" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Увімкнути рекламу")).toBeChecked();
  expect(screen.getByRole("status")).toHaveTextContent("Помилка");
  expect(screen.getByText(/Збережено: Вимкнено/)).toBeInTheDocument();
});
