import { supabase } from "@/integrations/supabase/client";
import { parseAudio, validateAudio, type AudioSettings } from "./audio-settings";
import type { Video } from "./backend";

export async function fetchAudio(signal: AbortSignal): Promise<AudioSettings> {
  const { data, error } = await supabase
    .from("playback_settings")
    .select("*")
    .eq("id", 1)
    .abortSignal(signal)
    .single();
  if (error) throw error;
  return parseAudio({
    musicUrls: data.music_urls,
    musicVolume: data.music_volume,
    videoVolume: data.video_volume,
    duckVolume: data.duck_volume,
    originalIds: data.original_video_ids,
  });
}
export async function writeAudio(settings: AudioSettings): Promise<AudioSettings> {
  const s = validateAudio(settings);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    // Update only the migration-created singleton. RLS is the authority, not UI gating.
    const { data, error } = await supabase
      .from("playback_settings")
      .update({
        music_urls: s.musicUrls,
        music_volume: s.musicVolume,
        video_volume: s.videoVolume,
        duck_volume: s.duckVolume,
        original_video_ids: s.originalIds,
      })
      .eq("id", 1)
      .select("id")
      .abortSignal(controller.signal)
      .single();
    if (error || !data) throw error || new Error("Налаштування не збережено");
    return s;
  } finally {
    clearTimeout(timeout);
  }
}
export async function fetchVideos(signal: AbortSignal): Promise<Video[]> {
  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
    .order("id")
    .abortSignal(signal);
  if (error) throw error;
  return data || [];
}
