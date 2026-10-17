import { it, expect, vi } from "vitest";
import { readPages } from "@/lib/admin-api";
it("loads past Supabase default row limit without losing the second page", async () => {
  const read = vi
    .fn()
    .mockResolvedValueOnce({ data: Array.from({ length: 1000 }, (_, i) => i), error: null })
    .mockResolvedValueOnce({ data: [1000, 1001], error: null });
  const data = await readPages<number>(read);
  expect(data).toHaveLength(1002);
  expect(data[1001]).toBe(1001);
  expect(read).toHaveBeenNthCalledWith(2, 1000, 1999);
});
it("does not expose a partially loaded library on network failure", async () => {
  const read = vi
    .fn()
    .mockResolvedValueOnce({ data: Array(1000).fill(1), error: null })
    .mockResolvedValueOnce({ data: null, error: new Error("offline") });
  await expect(readPages(read)).rejects.toThrow("Не вдалося прочитати");
});
it("bounds library reads and refuses oversized snapshots for reorder safety", async () => {
  await expect(
    readPages(async () => ({ data: Array(1000).fill(1), error: null }), 1000),
  ).rejects.toThrow("перевищує ліміт");
});
