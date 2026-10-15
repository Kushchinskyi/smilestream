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

function describePlayError(err: unknown): string {
  const name = (err as { name?: string })?.name ?? "";
  const msg = (err as { message?: string })?.message ?? String(err);
  if (name === "NotAllowedError") return "NotAllowedError: браузер заборонив відтворення без натискання.";
  if (name === "NotSupportedError") return "NotSupportedError: формат або адреса відео не підтримується.";
  if (name === "AbortError") return "AbortError: завантаження перервано.";
  return (name ? name + ": " : "") + msg;
}

function describeMediaError(v: HTMLVideoElement): string {
  const e = v.error;
  if (!e) return "Невідома помилка відео";
  switch (e.code) {
    case 1: return "MEDIA_ERR_ABORTED: завантаження перервано";
    case 2: return "MEDIA_ERR_NETWORK: помилка мережі";
    case 3: return "MEDIA_ERR_DECODE: не вдалося декодувати відео";
    case 4: return "MEDIA_ERR_SRC_NOT_SUPPORTED: формат/адреса не підтримується";
    default: return "Помилка відео (код " + e.code + ")";
  }
}

// Plain, compatibility-first player: no animations, no third-party embeds.
// play() is always invoked synchronously from a user gesture or a media event — never from useEffect.
function TvPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [list, setList] = useState<Video[] | null>(null);
  const [source, setSource] = useState<Source>("server");
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(true);
  const [status, setStatus] = useState("Завантаження плейлиста…");
  const [lastError, setLastError] = useState<string | null>(null);
  const [needsTap, setNeedsTap] = useState(false);
  const [showStatus, setShowStatus] = useState(false);

  const listRef = useRef<Video[]>([]);
  const indexRef = useRef(0);
  const mutedRef = useRef(true);
  const errorsRef = useRef(0);
  const hideTimer = useRef<number | undefined>(undefined);
  const advanceTimer = useRef<number | undefined>(undefined);
  const reloadTimer = useRef<number | undefined>(undefined);

  function clearTimers() {
    window.clearTimeout(advanceTimer.current);
    window.clearTimeout(reloadTimer.current);
    advanceTimer.current = undefined;
    reloadTimer.current = undefined;
  }

  async function fetchPlaylist(): Promise<{ items: Video[]; src: Source }> {
    if (!backendConfigured) return { items: DEMO_PLAYLIST, src: "demo" };
    try {
      const { data, error } = await supabase
        .from("videos").select("*").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return { items: data ?? [], src: "server" };
    } catch {
      return { items: DEMO_PLAYLIST, src: "demo" };
    }
  }

  function applyList(items: Video[], src: Source) {
    listRef.current = items;
    setList(items);
    setSource(src);
  }

  useEffect(() => {
    let alive = true;
    fetchPlaylist().then(({ items, src }) => { if (alive) applyList(items, src); });
    return () => {
      alive = false;
      clearTimers();
      window.clearTimeout(hideTimer.current);
    };
  }, []);

  // Must be called synchronously inside a click handler or media event.
  function playAt(i: number) {
    const v = videoRef.current;
    const items = listRef.current;
    if (!v) return;
    if (!items.length) {
      setStatus("Плейлист порожній. Повторна перевірка через 60 с.");
      scheduleReload(60000);
      return;
    }
    const idx = ((i % items.length) + items.length) % items.length;
    const item = items[idx]!;
    indexRef.current = idx;
    setIndex(idx);
    v.muted = mutedRef.current;
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
    v.src = item.url;
    setStatus("Відтворення: " + item.title);
    let p: Promise<void> | undefined;
    try {
      p = v.play();
    } catch (err) {
      handlePlayRejection(err);
      return;
    }
    if (p && typeof p.catch === "function") p.catch(handlePlayRejection);
  }

  function handlePlayRejection(err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === "AbortError") return; // superseded by a newer src
    const text = describePlayError(err);
    setLastError(text);
    if (name === "NotAllowedError") {
      setNeedsTap(true);
      setStatus("Потрібне натискання для запуску");
    } else {
      setStatus("Не вдалося відтворити, перехід до наступного ролика");
      scheduleAdvance(1500);
    }
  }

  function scheduleAdvance(ms: number) {
    window.clearTimeout(advanceTimer.current);
    advanceTimer.current = window.setTimeout(() => { advanceTimer.current = undefined; next(); }, ms);
  }

  function scheduleReload(ms: number) {
    window.clearTimeout(reloadTimer.current);
    reloadTimer.current = window.setTimeout(async () => {
      reloadTimer.current = undefined;
      const { items, src } = await fetchPlaylist();
      applyList(items, src);
      if (items.length) {
        indexRef.current = 0;
        playAt(0);
      } else scheduleReload(60000);
    }, ms);
  }

  function next() {
    clearTimers();
    const items = listRef.current;
    if (!items.length) { playAt(0); return; }
    const n = indexRef.current + 1;
    if (n >= items.length) {
      // End of loop: play first item immediately (keeps media activation), refresh list in background.
      playAt(0);
      fetchPlaylist().then(({ items: fresh, src }) => applyList(fresh, src));
    } else playAt(n);
  }

  function onError() {
    const v = videoRef.current;
    if (!v || !v.getAttribute("src")) return;
    const code = v.error?.code;
    const url = v.currentSrc || v.getAttribute("src") || "";
    const text = (code === 2 || code === 4
      ? "URL недоступний або не є MP4 (можливо 403/404/AccessDenied). "
      : "") + describeMediaError(v) + " · URL: " + url;
    setLastError(text);
    errorsRef.current += 1;
    const total = listRef.current.length || 1;
    if (errorsRef.current >= total * 2) {
      setStatus("Жоден ролик не відтворюється. Повтор через 30 с.");
      clearTimers();
      advanceTimer.current = window.setTimeout(() => { errorsRef.current = 0; next(); }, 30000);
      return;
    }
    setStatus("Помилка відтворення, перехід до наступного ролика");
    scheduleAdvance(1500);
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
    clearTimers();
    mutedRef.current = !withSound;
    setMuted(!withSound);
    setNeedsTap(false);
    setLastError(null);
    errorsRef.current = 0;
    setStarted(true);
    playAt(indexRef.current);
  }

  function retry() {
    clearTimers();
    setNeedsTap(false);
    setLastError(null);
    errorsRef.current = 0;
    playAt(indexRef.current);
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
          onPlaying={() => { errorsRef.current = 0; setLastError(null); setNeedsTap(false); }}
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

        {started && needsTap && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-ink/90 p-8 text-center">
            <p className="text-2xl">Браузер заблокував автозапуск</p>
            {lastError && <p className="text-base opacity-70">{lastError}</p>}
            <button autoFocus onClick={retry} className="rounded-2xl bg-teal px-12 py-8 text-3xl font-semibold text-teal-foreground focus:outline focus:outline-4 focus:outline-ink-foreground">
              ▶ Запустити знову
            </button>
          </div>
        )}

        {started && !needsTap && (showStatus || lastError || !list?.length) && (
          <div className="absolute bottom-0 left-0 right-0 bg-ink/90 p-6 text-xl">
            <div>{status}</div>
            {lastError && <div className="mt-2 text-base text-warning">{lastError}</div>}
            <div className="mt-2 text-base opacity-70">
              Ролик {list?.length ? index + 1 : 0} / {list?.length ?? 0} · {muted ? "без звуку" : "зі звуком"} · джерело: {source === "server" ? "сервер" : "демо"}
              {list?.[index]?.is_test ? " · ТЕСТОВЕ ВІДЕО" : ""}
            </div>
            <div className="mt-4 flex flex-wrap gap-4">
              <button onClick={retry} className="rounded-lg bg-teal px-6 py-3 text-teal-foreground">Перезапустити</button>
              <button onClick={fullscreen} className="rounded-lg border border-ink-foreground px-6 py-3">Повний екран</button>
              <button
                onClick={() => { const v = videoRef.current; if (v) { v.muted = !v.muted; mutedRef.current = v.muted; setMuted(v.muted); } }}
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
