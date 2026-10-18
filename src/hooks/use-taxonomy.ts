import { useCallback, useEffect, useRef, useState } from "react";
import { readTaxonomy } from "@/lib/video-taxonomy-api";
import type { Taxonomy } from "@/lib/video-taxonomy";
export function useTaxonomy() {
  const [data, setData] = useState<Taxonomy | null>(null),
    [error, setError] = useState("");
  const current = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    current.current?.abort();
    const controller = new AbortController();
    current.current = controller;
    const deadline = setTimeout(() => controller.abort(), 12000);
    try {
      const fresh = await readTaxonomy(controller.signal);
      if (!controller.signal.aborted) {
        setData(fresh);
        setError("");
      }
    } catch {
      if (current.current === controller)
        setError("Класифікація недоступна. Перевірте мережу, права та міграцію video_taxonomy.");
    } finally {
      clearTimeout(deadline);
    }
  }, []);
  useEffect(() => {
    void refresh();
    return () => {
      current.current?.abort();
      current.current = null;
    };
  }, [refresh]);
  return { data, error, refresh };
}
