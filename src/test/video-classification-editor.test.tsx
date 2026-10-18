import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import { VideoClassificationEditor } from "@/components/VideoClassificationEditor";
import type { Taxonomy } from "@/lib/video-taxonomy";
const mocks = vi.hoisted(() => ({ write: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/video-taxonomy-api", () => ({ classifyVideos: mocks.write }));
const id = "f01d0000-0000-4000-8000-000000000001",
  other = "f01d0000-0000-4000-8000-000000000002";
const data: Taxonomy = {
  categories: [
    { id, slug: "hygiene", name: "Гігієна", description: "", sort_order: 1, is_active: true },
  ],
  formats: [{ id, slug: "education", name: "Освітнє відео", sort_order: 1, is_active: true }],
  tags: [
    {
      id,
      slug: "brush",
      name: "Зубні щітки",
      group_key: "procedure",
      aliases: ["toothbrush"],
      is_active: true,
    },
  ],
  classifications: [],
  relations: [],
};
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("single video saves optional empty fields and explicit tag replacement", async () => {
  render(
    <VideoClassificationEditor
      ids={[id]}
      data={data}
      onClose={vi.fn()}
      onSaved={vi.fn().mockResolvedValue(undefined)}
    />,
  );
  fireEvent.change(screen.getByLabelText("Основна категорія"), { target: { value: id } });
  fireEvent.click(screen.getByLabelText("Зубні щітки"));
  fireEvent.click(screen.getByRole("button", { name: "Зберегти класифікацію" }));
  await waitFor(() =>
    expect(mocks.write).toHaveBeenCalledWith(
      [id],
      expect.objectContaining({ category_id: id, format_id: null, tags_replace: [id] }),
    ),
  );
});
it("bulk mode leaves unchanged fields intact and can remove selected tags", async () => {
  render(
    <VideoClassificationEditor
      ids={[id, other]}
      data={data}
      onClose={vi.fn()}
      onSaved={vi.fn().mockResolvedValue(undefined)}
    />,
  );
  fireEvent.change(screen.getByLabelText("Дія з тегами"), { target: { value: "tags_remove" } });
  fireEvent.click(screen.getByLabelText("Зубні щітки"));
  fireEvent.click(screen.getByRole("button", { name: "Зберегти класифікацію" }));
  await waitFor(() => expect(mocks.write).toHaveBeenCalledWith([id, other], { tags_remove: [id] }));
});
it("keeps the editor open and reports a failed transaction", async () => {
  mocks.write.mockRejectedValueOnce(Error("transaction failed"));
  const close = vi.fn();
  render(<VideoClassificationEditor ids={[id]} data={data} onClose={close} onSaved={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Зберегти класифікацію" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("transaction failed");
  expect(close).not.toHaveBeenCalled();
});
