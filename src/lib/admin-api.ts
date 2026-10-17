import { supabase } from "@/integrations/supabase/client";
import type { Video } from "./backend";
import type { MediaMetadata } from "./admin-library";
export async function readPages<T>(
  read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  max = 10000,
): Promise<T[]> {
  const result: T[] = [];
  for (let from = 0; from <= max; from += 1000) {
    const page = await read(from, from + 999);
    if (page.error) throw new Error("Не вдалося прочитати бібліотеку. Перевірте мережу й права.");
    result.push(...(page.data || []));
    if (result.length > max)
      throw new Error(`Бібліотека перевищує ліміт ${max}. Операцію зупинено без часткових даних.`);
    if (!page.data || page.data.length < 1000) return result;
  }
  throw new Error("Не вдалося завершити читання бібліотеки");
}
export function readAdminVideos(signal: AbortSignal) {
  return readPages<Video>((from, to) =>
    supabase
      .from("videos")
      .select("*")
      .order("sort_order")
      .order("id")
      .range(from, to)
      .abortSignal(signal),
  );
}
export function readAdminMetadata(signal: AbortSignal) {
  return readPages<MediaMetadata>(
    (from, to) =>
      supabase
        .from("media_metadata")
        .select("*")
        .order("kind")
        .order("source_key")
        .range(from, to)
        .abortSignal(signal),
    15000,
  );
}
