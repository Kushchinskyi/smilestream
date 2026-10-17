import { supabase } from "@/integrations/supabase/client";
import { validateProfile, type MusicProfile } from "./music-profiles";
export async function fetchMusicProfiles(signal: AbortSignal): Promise<MusicProfile[]> {
  const { data, error } = await supabase
    .from("music_profiles")
    .select("*")
    .order("sort_order")
    .order("id")
    .limit(1001)
    .abortSignal(signal);
  if (error) throw error;
  if ((data?.length || 0) > 1000) throw new Error("Перевищено ліміт 1000 профілів");
  return (data || []).map(validateProfile);
}
export async function saveMusicProfile(profile: MusicProfile) {
  const clean = validateProfile(profile);
  const controller = new AbortController(),
    deadline = setTimeout(() => controller.abort(), 12000);
  try {
    const { error } = await supabase
      .rpc("save_music_profile", { profile: clean })
      .abortSignal(controller.signal);
    if (error) throw new Error(error.message);
  } finally {
    clearTimeout(deadline);
  }
}
