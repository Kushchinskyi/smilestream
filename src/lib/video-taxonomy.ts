import type { Video } from "./backend";
import { isVideoId } from "./audio-settings";
export const TAG_GROUPS = {
  direction: "Стоматологічний напрям",
  procedure: "Процедура або виріб",
  technology: "Технологія",
  material: "Матеріал",
  stage: "Етап роботи",
  feature: "Особливості відео",
} as const;
export type TagGroup = keyof typeof TAG_GROUPS;
export type DictionaryEntry = {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};
export type VideoCategory = DictionaryEntry & { description: string };
export type VideoTag = {
  id: string;
  slug: string;
  name: string;
  group_key: TagGroup;
  aliases: string[];
  is_active: boolean;
};
export type VideoClassification = {
  video_id: string;
  category_id: string | null;
  format_id: string | null;
  wow_score: number | null;
  case_id: string | null;
  review_status: "needs_classification" | "classified";
  evidence: string;
};
export type TagRelation = { video_id: string; tag_id: string };
export type Taxonomy = {
  categories: VideoCategory[];
  formats: DictionaryEntry[];
  tags: VideoTag[];
  classifications: VideoClassification[];
  relations: TagRelation[];
};
export type ClassificationPatch = Partial<Omit<VideoClassification, "video_id">> & {
  tags_add?: string[];
  tags_remove?: string[];
  tags_replace?: string[];
};
export function validateClassification(ids: string[], patch: ClassificationPatch) {
  if (!ids.length || ids.length > 500 || new Set(ids).size !== ids.length || !ids.every(isVideoId))
    throw Error("Оберіть від 1 до 500 різних відео");
  const keys = [
    "category_id",
    "format_id",
    "wow_score",
    "case_id",
    "review_status",
    "evidence",
    "tags_add",
    "tags_remove",
    "tags_replace",
  ];
  if (Object.keys(patch).some((k) => !keys.includes(k))) throw Error("Невідоме поле класифікації");
  for (const key of ["category_id", "format_id", "case_id"] as const)
    if (patch[key] !== undefined && patch[key] !== null && !isVideoId(patch[key]))
      throw Error("Некоректний ідентифікатор");
  for (const key of ["tags_add", "tags_remove", "tags_replace"] as const) {
    const tags = patch[key];
    if (tags && (tags.length > 100 || new Set(tags).size !== tags.length || !tags.every(isVideoId)))
      throw Error("Некоректний список тегів");
  }
  if (
    patch.wow_score !== undefined &&
    patch.wow_score !== null &&
    (!Number.isInteger(patch.wow_score) || patch.wow_score < 0 || patch.wow_score > 100)
  )
    throw Error("WOW: ціле число від 0 до 100");
  if (
    patch.evidence !== undefined &&
    (typeof patch.evidence !== "string" || patch.evidence.length > 1000)
  )
    throw Error("Примітка: до 1000 символів");
  if (
    patch.review_status !== undefined &&
    !["classified", "needs_classification"].includes(patch.review_status)
  )
    throw Error("Некоректний статус");
  return patch;
}
export function matchesClassification(
  id: string,
  taxonomy: Taxonomy,
  category: string,
  format: string,
  tags: string[],
  needsReview = false,
) {
  const row = taxonomy.classifications.find((c) => c.video_id === id);
  const linked = new Set(taxonomy.relations.filter((r) => r.video_id === id).map((r) => r.tag_id));
  return (
    (category === "all" ||
      (category === "none" ? !row?.category_id : row?.category_id === category)) &&
    (format === "all" || (format === "none" ? !row?.format_id : row?.format_id === format)) &&
    (!needsReview || row?.review_status !== "classified") &&
    tags.every((t) => linked.has(t))
  );
}
// A union of matching videos, never a sum of per-tag totals. No scheduler/weights.
export function taggedAirtime(videos: Video[], relations: TagRelation[], tagIds: string[]) {
  const matching = new Set(
    relations.filter((r) => tagIds.includes(r.tag_id)).map((r) => r.video_id),
  );
  const unique = new Map(videos.filter((v) => matching.has(v.id)).map((v) => [v.id, v]));
  return {
    videos: unique.size,
    seconds: [...unique.values()].reduce((sum, v) => sum + Math.max(0, v.duration_seconds), 0),
  };
}
