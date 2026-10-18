import { supabase } from "@/integrations/supabase/client";
import { readPages } from "./admin-api";
import {
  validateClassification,
  type Taxonomy,
  type ClassificationPatch,
  type VideoCategory,
  type VideoTag,
} from "./video-taxonomy";
export async function readTaxonomy(signal: AbortSignal): Promise<Taxonomy> {
  const [categories, formats, tags, classifications, relations] = await Promise.all([
    readPages((a, b) =>
      supabase
        .from("video_categories")
        .select("*")
        .order("sort_order")
        .order("id")
        .range(a, b)
        .abortSignal(signal),
    ),
    readPages((a, b) =>
      supabase
        .from("video_content_formats")
        .select("*")
        .order("sort_order")
        .order("id")
        .range(a, b)
        .abortSignal(signal),
    ),
    readPages((a, b) =>
      supabase
        .from("video_tags")
        .select("*")
        .order("group_key")
        .order("name")
        .order("id")
        .range(a, b)
        .abortSignal(signal),
    ),
    readPages((a, b) =>
      supabase
        .from("video_classification")
        .select("*")
        .order("video_id")
        .range(a, b)
        .abortSignal(signal),
    ),
    readPages(
      (a, b) =>
        supabase
          .from("video_tag_relations")
          .select("*")
          .order("video_id")
          .order("tag_id")
          .range(a, b)
          .abortSignal(signal),
      100000,
    ),
  ]);
  return { categories, formats, tags, classifications, relations };
}
export async function classifyVideos(ids: string[], patch: ClassificationPatch) {
  const clean = validateClassification(ids, patch);
  const r = await supabase.rpc("classify_videos", { p_ids: ids, p_patch: clean });
  if (r.error) throw Error("Класифікацію не збережено: " + r.error.message);
}
export async function saveCategory(category: Partial<VideoCategory>) {
  const r = category.id
    ? await supabase
        .from("video_categories")
        .update(category)
        .eq("id", category.id)
        .select("id")
        .single()
    : await supabase.from("video_categories").insert(category).select("id").single();
  if (r.error) throw Error("Категорію не збережено: " + r.error.message);
}
export async function saveTag(tag: Partial<VideoTag>) {
  const r = tag.id
    ? await supabase.from("video_tags").update(tag).eq("id", tag.id).select("id").single()
    : await supabase.from("video_tags").insert(tag).select("id").single();
  if (r.error)
    throw Error(
      r.error.code === "23505"
        ? "Назва, slug або синонім уже існує у цій групі. Відредагуйте або об’єднайте наявний тег."
        : "Тег не збережено: " + r.error.message,
    );
}
export async function mergeTags(source: string, target: string) {
  const r = await supabase.rpc("merge_video_tags", { p_source: source, p_target: target });
  if (r.error) throw Error("Об’єднання не виконано: " + r.error.message);
}
export async function deleteVideoRecords(ids: string[], confirmation: string) {
  validateClassification(ids, {});
  if (confirmation !== `ВИДАЛИТИ ${ids.length}`) throw Error("Підтвердіть кількість записів");
  const r = await supabase.rpc("delete_video_records", {
    p_ids: ids,
    p_confirmation: confirmation,
  });
  if (r.error) throw Error("Видалення не виконано: " + r.error.message);
}
