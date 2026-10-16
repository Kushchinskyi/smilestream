import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { backendConfigured, type Video } from "@/lib/backend";
import { TvPlayback } from "@/lib/tv-playback";
import { fetchAudio, fetchVideos } from "@/lib/playback-api";
import { startPolling } from "@/lib/playback-sync";

export const Route = createFileRoute("/tv")({
  ssr: false,
  component: TvPage,
  head: () => ({
    meta: [
      { title: "ТВ-плеєр — Smile Stream" },
      { name: "description", content: "Безперервний відеоплеєр для телевізорів у клініці." },
    ],
  }),
});

function TvPage() {
  const surface = useRef<HTMLDivElement>(null);
  const focusDirection = useRef(1);
  const [navigation, setNavigation] = useState(0);
  const first = useRef<HTMLVideoElement>(null);
  const second = useRef<HTMLVideoElement>(null);
  const music = useRef<HTMLAudioElement>(null);
  const player = useRef<TvPlayback | null>(null);
  const [items, setItems] = useState<Video[] | null>(null);
  const [syncStatus, setSyncStatus] = useState("");
  const [started, setStarted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [persistentStatus, setPersistentStatus] = useState(false);
  const [status, setStatus] = useState("Завантаження плейлиста…");
  const [controls, setControls] = useState(true);
  const hide = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!first.current || !second.current || !music.current) return;
    const p = new TvPlayback(
      [first.current, second.current],
      music.current,
      [],
      (message, needsTap = false, persistent = false) => {
        setStatus(message);
        setPersistentStatus(persistent);
        if (needsTap) setBlocked(true);
      },
    );
    player.current = p;
    const errors = new Set<string>();
    function syncError(key: string, failed: boolean) {
      if (failed) errors.add(key);
      else errors.delete(key);
      setSyncStatus(
        errors.size
          ? "Синхронізація недоступна: " +
              [...errors].join(", ") +
              ". Збережено останній стан; повтор автоматично."
          : "",
      );
    }
    const stopVideos = backendConfigured
      ? startPolling(
          fetchVideos,
          (fresh) => {
            p.updatePlaylist(fresh);
            setItems(fresh);
            syncError("плейлист", false);
          },
          () => syncError("плейлист", true),
        )
      : () => {};
    const stopAudio = backendConfigured
      ? startPolling(
          fetchAudio,
          (settings) => {
            p.updateSettings(settings);
            syncError("звук", false);
          },
          () => syncError("звук", true),
        )
      : () => {};
    if (!backendConfigured) {
      setStatus("Плейлист недоступний без налаштованого сервера.");
      setSyncStatus("Сервер не налаштовано. Демо-контент не додається.");
    }
    return () => {
      stopVideos();
      stopAudio();
      p.dispose();
      player.current = null;
    };
  }, []);
  useEffect(() => {
    const reveal = () => {
      setControls(true);
      clearTimeout(hide.current);
      hide.current = setTimeout(() => setControls(false), 8000);
    };
    const onKey = (event: KeyboardEvent) => {
      reveal();
      const key =
        event.key ||
        (
          {
            13: "Enter",
            37: "ArrowLeft",
            38: "ArrowUp",
            39: "ArrowRight",
            40: "ArrowDown",
          } as Record<number, string>
        )[event.keyCode];
      const arrow = ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(key || "");
      const enterWithoutFocus =
        key === "Enter" &&
        !(
          document.activeElement instanceof HTMLButtonElement &&
          surface.current?.contains(document.activeElement)
        );
      if (arrow || enterWithoutFocus) {
        event.preventDefault();
        focusDirection.current = key === "ArrowLeft" || key === "ArrowUp" ? -1 : 1;
        setNavigation((n) => n + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", reveal);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", reveal);
      clearTimeout(hide.current);
    };
  }, []);
  useEffect(() => {
    if (!navigation) return;
    const buttons = Array.from(
      surface.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") || [],
    );
    if (!buttons.length) return;
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[
      index < 0 ? 0 : (index + focusDirection.current + buttons.length) % buttons.length
    ]?.focus();
  }, [navigation]);
  function start(sound: boolean) {
    setStarted(true);
    setBlocked(false);
    player.current?.start(sound);
  }
  return (
    <div ref={surface} className="tv-screen fixed inset-0 bg-black text-white">
      {[first, second].map((ref, i) => (
        <video
          key={i}
          ref={ref}
          playsInline
          muted
          preload="auto"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            zIndex: i === 0 ? 1 : 0,
          }}
        />
      ))}
      <audio ref={music} preload="auto" />
      {(!started || blocked) && (
        <div
          style={{ position: "absolute", inset: 0, zIndex: 3, background: "#111" }}
          className="tv-start flex flex-col items-center justify-center gap-6 p-8 text-center"
        >
          <h1 className="text-3xl">Smile Stream</h1>
          <p>{status}</p>
          {items?.length === 0 && <p>Плейлист порожній; оновлення автоматично.</p>}
          {syncStatus && <p>{syncStatus}</p>}
          {!!items?.length && (
            <>
              <button autoFocus className="rounded border p-6 text-2xl" onClick={() => start(true)}>
                ▶ {blocked ? "Продовжити зі звуком" : "Запустити зі звуком"}
              </button>
              <button className="rounded border p-6" onClick={() => start(false)}>
                Запустити без звуку
              </button>
            </>
          )}
        </div>
      )}
      {started && (controls || persistentStatus) && !blocked && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 2,
            background: "rgba(0,0,0,.85)",
          }}
          className="tv-status space-y-4 p-6"
        >
          <p role="status">{status}</p>
          {syncStatus && <p>{syncStatus}</p>}
          <div className="flex flex-wrap gap-4">
            <button className="rounded border p-4" onClick={() => player.current?.resume()}>
              Продовжити
            </button>
            <button className="rounded border p-4" onClick={() => player.current?.toggleSound()}>
              Увімкнути / вимкнути звук
            </button>
            <button className="rounded border p-4" onClick={() => player.current?.next()}>
              Наступний
            </button>
            <button
              className="rounded border p-4"
              onClick={() => {
                const el = document.documentElement as HTMLElement & {
                  webkitRequestFullscreen?: () => void;
                };
                try {
                  if (el.requestFullscreen) void el.requestFullscreen().catch(() => undefined);
                  else el.webkitRequestFullscreen?.();
                } catch {
                  /* unsupported */
                }
              }}
            >
              Повний екран
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
