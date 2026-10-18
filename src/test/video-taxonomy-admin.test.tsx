import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import { TaxonomyDictionary } from "@/components/TaxonomyDictionary";
import { ProfessionalVideoLibrary } from "@/components/ProfessionalVideoLibrary";
import type { Video } from "@/lib/backend";
const mocks = vi.hoisted(() => ({
  refresh: vi.fn().mockResolvedValue(undefined),
  category: vi.fn().mockResolvedValue(undefined),
  tag: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
}));
const id = "f01d0000-0000-4000-8000-000000000001";
vi.mock("@/hooks/use-taxonomy", () => ({
  useTaxonomy: () => ({
    data: { categories: [], formats: [], tags: [], classifications: [], relations: [] },
    error: "",
    refresh: mocks.refresh,
  }),
}));
vi.mock("@/lib/video-taxonomy-api", () => ({
  saveCategory: mocks.category,
  saveTag: mocks.tag,
  deleteVideoRecords: mocks.remove,
  mergeTags: vi.fn(),
  classifyVideos: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("creates a category with its description and explicit order", async () => {
  render(<TaxonomyDictionary videos={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Додати категорію" }));
  fireEvent.change(screen.getByLabelText("Назва"), { target: { value: "Новий розділ" } });
  fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "new-section" } });
  fireEvent.change(screen.getByLabelText("Опис"), { target: { value: "Перевірений опис" } });
  fireEvent.change(screen.getByLabelText("Порядок"), { target: { value: "13" } });
  fireEvent.click(screen.getByRole("button", { name: "Зберегти" }));
  await waitFor(() =>
    expect(mocks.category).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Новий розділ",
        slug: "new-section",
        description: "Перевірений опис",
        sort_order: 13,
      }),
    ),
  );
});
it("retains a tag draft after a duplicate alias is rejected", async () => {
  mocks.tag.mockRejectedValueOnce(Error("Синонім уже існує"));
  render(<TaxonomyDictionary videos={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Додати тег" }));
  fireEvent.change(screen.getByLabelText("Назва"), { target: { value: "Новий тег" } });
  fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "new-tag" } });
  fireEvent.change(screen.getByLabelText("Синоніми / англійські відповідники (через кому)"), {
    target: { value: " implant , implants " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Зберегти" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Синонім уже існує");
  expect(screen.getByLabelText("Назва")).toHaveValue("Новий тег");
  expect(mocks.tag).toHaveBeenCalledWith(
    expect.objectContaining({ aliases: ["implant", "implants"] }),
  );
});
it("requires an exact record-count confirmation before deleting and retains failed batches", async () => {
  mocks.remove.mockRejectedValueOnce(Error("Library changed"));
  const deleted = vi.fn();
  render(
    <ProfessionalVideoLibrary
      videos={[
        {
          id,
          title: "Тестове відео",
          url: "https://example.com/video.mp4",
          duration_seconds: 30,
          sort_order: 1,
          is_active: true,
          is_test: false,
        } as Video,
      ]}
      metadata={[]}
      originalIds={[]}
      busy={false}
      deleteAllowed
      onDeleted={deleted}
      onEdit={vi.fn()}
      onPreview={vi.fn()}
      onActive={vi.fn()}
      onOriginal={vi.fn()}
      onReorder={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByLabelText("Обрати Тестове відео"));
  fireEvent.click(screen.getByRole("button", { name: "Видалити записи…" }));
  const remove = screen.getByRole("button", { name: "Остаточно видалити записи" });
  expect(remove).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Введіть «ВИДАЛИТИ 1»"), {
    target: { value: "ВИДАЛИТИ 2" },
  });
  expect(remove).toBeDisabled();
  expect(mocks.remove).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Введіть «ВИДАЛИТИ 1»"), {
    target: { value: "ВИДАЛИТИ 1" },
  });
  fireEvent.click(remove);
  expect(await screen.findByRole("alert")).toHaveTextContent("Library changed");
  expect(deleted).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeVisible();
});
