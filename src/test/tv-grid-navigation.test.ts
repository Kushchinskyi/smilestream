import { expect, it } from "vitest";
import { tvGridTarget } from "@/lib/tv-grid-navigation";

it("moves by columns horizontally and rows vertically without wrapping row edges", () => {
  expect(tvGridTarget(0, 9, "ArrowRight")).toBe(1);
  expect(tvGridTarget(2, 9, "ArrowRight")).toBe(2);
  expect(tvGridTarget(3, 9, "ArrowLeft")).toBe(3);
  expect(tvGridTarget(1, 9, "ArrowDown")).toBe(4);
  expect(tvGridTarget(7, 9, "ArrowUp")).toBe(4);
  expect(tvGridTarget(7, 9, "ArrowDown")).toBe(7);
  expect(tvGridTarget(0, 9, "ArrowUp")).toBe(0);
});
it("keeps focus inside short final rows and recovers absent focus", () => {
  expect(tvGridTarget(2, 4, "ArrowDown")).toBe(3);
  expect(tvGridTarget(-1, 9, "ArrowDown")).toBe(0);
  expect(tvGridTarget(0, 1, "ArrowRight")).toBe(0);
});
