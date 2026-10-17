import { supabase } from "@/integrations/supabase/client";
import { validateAdSettings, type AdConfiguration, type AdSettings } from "./ad-scheduler";
import { isMusicUrl } from "./audio-settings";
export async function fetchAdSettings(signal: AbortSignal): Promise<AdSettings> {
  const { data, error } = await supabase
    .from("ad_playback_settings")
    .select("enabled,interval_minutes,block_count")
    .eq("id", 1)
    .abortSignal(signal)
    .single();
  if (error || !data) throw error || new Error("Налаштування недоступні");
  return validateAdSettings(data);
}
export async function fetchAdvertisements(signal: AbortSignal): Promise<AdConfiguration> {
  const { data, error } = await supabase.rpc("read_ad_playback").abortSignal(signal);
  if (error || !data) throw error || new Error("Реклама недоступна");
  const snapshot = data as unknown as AdConfiguration;
  const settings = validateAdSettings(snapshot.settings);
  if (!Array.isArray(snapshot.advertisements) || snapshot.advertisements.length > 1000)
    throw new Error("Некоректна рекламна бібліотека");
  return {
    settings,
    advertisements: snapshot.advertisements
      .filter(
        (a) =>
          a.is_active &&
          isMusicUrl(a.url) &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(a.id),
      )
      .map((a) => ({ ...a, is_test: false, original_sound: a.original_sound === true })),
  };
}
export async function writeAdSettings(settings: AdSettings) {
  const clean = validateAdSettings(settings);
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 12000);
  try {
    const { data, error } = await supabase
      .from("ad_playback_settings")
      .update(clean)
      .eq("id", 1)
      .select("id")
      .abortSignal(controller.signal)
      .single();
    if (error || !data) throw error || new Error("Налаштування не збережено");
    return clean;
  } finally {
    clearTimeout(timer);
  }
}
