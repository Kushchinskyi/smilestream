import { describe, expect, it } from "vitest";
import { ensureTizenBuiltins } from "@/lib/tizen-compat";

describe("Tizen runtime fallback", () => {
  it("fills a missing Object.hasOwn without changing a native implementation", () => {
    const descriptor = Object.getOwnPropertyDescriptor(Object, "hasOwn")!;
    try {
      Object.defineProperty(Object, "hasOwn", { ...descriptor, value: undefined });
      ensureTizenBuiltins();
      const fallback = Object.hasOwn as (value: unknown, key: PropertyKey) => boolean;
      expect(fallback({ own: 1 }, "own")).toBe(true);
      expect(fallback(Object.create({ inherited: 1 }), "inherited")).toBe(false);
      expect(fallback(Object.assign(Object.create(null), { x: 1 }), "x")).toBe(true);
      expect(fallback("text", 0)).toBe(true);
      expect(() => fallback(null, "x")).toThrow();
      ensureTizenBuiltins();
      expect(Object.hasOwn).toBe(fallback);
    } finally {
      Object.defineProperty(Object, "hasOwn", descriptor);
    }
    ensureTizenBuiltins();
    expect(Object.hasOwn).toBe(descriptor.value);
  });
});
