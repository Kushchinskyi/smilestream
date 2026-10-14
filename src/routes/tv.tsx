import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { backendConfigured, DEMO_PLAYLIST, type Video } from "@/lib/backend";

export const Route = createFileRoute("/tv")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ТВ-плеєр — Dental Media Network" },
      { name: "description", content: "Повноекранний плеєр для телевізорів у клініці." },
      { property: "og:title", content: "ТВ-плеєр — Dental Media Network" },
      { property: "og:description", content: "Повноекранний плеєр для Smart TV." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TvPage,
});

type Source = "server" | "demo";

// Plain, compatibility-first player: no animations, no third-party embeds.
function TvPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [list, setList] = useState<Video[] | null>(null);
  const [source, setSource] = useState<Source>("server");
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(true);
  const [status, setStatus] = useState("Завантаження плейлиста…");
  const [showStatus, setShowStatus] = useState(false);
  const [errors, setErrors] = useState(0);
  const hideTimer = useRef<number | undefined>(undefined);

  async function loadPlaylist() {
    if (!backendConfigured) {
      setSource("demo");
      setList(DEMO_PLAYLIST);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      setSource("server");
      setList(data);
    } catch {
      setSource("demo");
      setList(DEMO_PLAYLIST);
    }
  }

  useEffect(() => {
    loadPlaylist();
  }, []);

  const current = list && list.length ? list[index % list.length] : null;

  // Load and play current item
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !current || !started) return;
    v.src = current.url;
    v.muted = muted;
    v.load();
    setStatus("Відтворення: " + current.title);
    const p = v.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        // Autoplay with sound blocked → retry muted
        v.muted = true;
        setMuted(true);
        v.play().catch(() => setStatus("Браузер заблокував автозапуск. Натисніть OK."));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, index, started]);

  function next() {
    if (!list || !list.length) return;
    const n = index + 1;
    if (n >= list.length) {
      // end of loop: refresh playlist from server so admin changes apply
      loadPlaylist();
      setIndex(0);
    } else setIndex(n);
  }

  function onError() {
    setErrors((e) => e + 1);
    setStatus("Помилка відтворення, перехід до наступного ролика");
    if (list && errors + 1 >= list.length * 2) {
      setStatus("Жоден ролик не відтворюється. Повтор через 30 с.");
      window.setTimeout(() => { setErrors(0); next(); }, 30000);
      return;
    }
    window.setTimeout(next, 1500);
  }

  function reveal() {
    setShowStatus(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setShowStatus(false), 6000);
  }

  function fullscreen() {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    try {
      if (el.requestFullscreen) el.requestFullscreen().catch(() => undefined);
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } catch { /* ignore */ }
  }

  function start(withSound: boolean) {
    setMuted(!withSound);
    setStarted(true);
    fullscreen();
  }

  useEffect(() => {
    function onKey() { if (started) reveal(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-ink text-ink-foreground">
      <div className="relative w-full" style={{ maxWidth: "177.78vh", aspectRatio: "16 / 9" }}>
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full bg-ink"
          playsInline
          muted={muted}
          preload="auto"
          onEnded={next}
          onError={onError}
          onPlaying={() => setErrors(0)}
          onClick={reveal}
        />

        {!started && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 bg-ink p-8 text-center">
            <div className="font-display text-3xl">Dental Media Network</div>
            {list === null ? (
              <p className="text-xl opacity-70">{status}</p>
            ) : list.length === 0 ? (
              <p className="text-xl opacity-70">Плейлист порожній. Додайте активні ролики в панелі керування.</p>
            ) : (
              <>
                <div className="flex flex-wrap justify-center gap-6">
                  <button autoFocus onClick={() => start(false)} className="rounded-2xl bg-teal px-12 py-8 text-3xl font-semibold text-teal-foreground focus:outline focus:outline-4 focus:outline-ink-foreground">
                    ▶ Запустити
                  </button>
                  <button onClick={() => start(true)} className="rounded-2xl border-2 border-ink-foreground px-12 py-8 text-3xl focus:outline focus:outline-4 focus:outline-teal">
                    Зі звуком
                  </button>
                </div>
                <p className="text-lg opacity-60">{list.length} ролик(ів) у плейлисті</p>
              </>
            )}
            {source === "demo" && (
              <p className="rounded-lg bg-warning px-4 py-2 text-lg text-warning-foreground">Демо-режим: сервер недоступний, показуються тестові відео</p>
            )}
          </div>
        )}

        {started && showStatus && (
          <div className="absolute bottom-0 left-0 right-0 bg-ink/90 p-6 text-xl">
            <div>{status}</div>
            <div className="mt-2 text-base opacity-70">
              Ролик {list ? (index % list.length) + 1 : 0} / {list?.length ?? 0} · {muted ? "без звуку" : "зі звуком"} · джерело: {source === "server" ? "сервер" : "демо"}
              {current?.is_test ? " · ТЕСТОВЕ ВІДЕО" : ""}
            </div>
            <div className="mt-4 flex gap-4">
              <button onClick={fullscreen} className="rounded-lg bg-teal px-6 py-3 text-teal-foreground">Повний екран</button>
              <button
                onClick={() => { const v = videoRef.current; if (v) { v.muted = !v.muted; setMuted(v.muted); } }}
                className="rounded-lg border border-ink-foreground px-6 py-3"
              >
                {muted ? "Увімкнути звук" : "Вимкнути звук"}
              </button>
              <button onClick={next} className="rounded-lg border border-ink-foreground px-6 py-3">Наступний</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
