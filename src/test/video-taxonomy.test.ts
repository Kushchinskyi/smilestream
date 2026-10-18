import { describe, it, expect } from "vitest";
import {
  validateClassification,
  matchesClassification,
  taggedAirtime,
  type Taxonomy,
} from "@/lib/video-taxonomy";
const id = "f01d0000-0000-4000-8000-000000000001",
  other = "f01d0000-0000-4000-8000-000000000002";
const taxonomy: Taxonomy = {
  categories: [],
  formats: [],
  tags: [],
  classifications: [
    {
      video_id: id,
      category_id: other,
      format_id: id,
      wow_score: null,
      case_id: null,
      review_status: "classified",
      evidence: "Title",
    },
  ],
  relations: [
    { video_id: id, tag_id: id },
    { video_id: id, tag_id: other },
  ],
};
describe("video taxonomy independent from playback", () => {
  it("accepts empty/null fields and no tags without inventing classification", () => {
    expect(
      validateClassification([id], {
        category_id: null,
        format_id: null,
        tags_replace: [],
        wow_score: null,
      }),
    ).toMatchObject({ tags_replace: [] });
    expect(matchesClassification(other, taxonomy, "none", "none", [], true)).toBe(true);
  });
  it("filters multiple tags with AND and respects category, format and review status", () => {
    expect(matchesClassification(id, taxonomy, other, id, [id, other])).toBe(true);
    expect(matchesClassification(id, taxonomy, other, id, ["missing"])).toBe(false);
    expect(matchesClassification(id, taxonomy, "all", "all", [], true)).toBe(false);
  });
  it("counts unique video minutes instead of double-counting overlapping tags", () => {
    const v = {
      id,
      title: "fixture",
      url: "https://example.invalid/a.mp4",
      duration_seconds: 60,
      sort_order: 1,
      is_active: true,
      is_test: true,
    };
    expect(taggedAirtime([v, v], taxonomy.relations, [id, other])).toEqual({
      videos: 1,
      seconds: 60,
    });
  });
  it("rejects unbounded/invalid IDs, duplicate tags and unsupported fields", () => {
    expect(() => validateClassification([], {})).toThrow();
    expect(() => validateClassification([id, id], {})).toThrow();
    expect(() => validateClassification([id], { wow_score: 101 })).toThrow();
    expect(() => validateClassification([id], { wow_score: 2.5 })).toThrow();
    expect(() => validateClassification([id], { tags_add: [id, id] })).toThrow();
    expect(() => validateClassification([id], { tags_add: ["bad"] })).toThrow();
    expect(() => validateClassification([id], { category_id: "bad" })).toThrow();
    expect(() => validateClassification([id], { url: "https://evil.invalid" } as never)).toThrow();
  });
});
