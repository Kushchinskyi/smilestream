import { TvPlayback } from "../../src/lib/tv-playback";
import { ensureTizenBuiltins } from "../../src/lib/tizen-compat";
import { playlist, audioSettings, localMediaHost } from "./fixtures";
import "./style.css";

ensureTizenBuiltins();
if (!localMediaHost(location.hostname) || location.port !== "4173")
  throw new Error("LOCAL MEDIA TEST requires localhost/private LAN on port 4173");
const app = document.querySelector<HTMLElement>("#app")!;
app.innerHTML = `<video playsinline muted></video><video playsinline muted></video><audio></audio>
<section aria-label="Media test diagnostics"><strong>LOCAL MEDIA TEST — Supabase OFF</strong>
<p id="status">Готово. Запустіть зі звуком.</p><pre id="diagnostics"></pre>
<div id="controls"></div></section>`;
const videos = Array.from(app.querySelectorAll("video"));
videos[0]!.style.zIndex = "1";
const music = app.querySelector("audio")!;
const status = app.querySelector("#status")!;
const diagnostics = app.querySelector("#diagnostics")!;
const controls = app.querySelector("#controls")!;
const settings = { ...audioSettings };
let switches = 0,
  loops = 0,
  errors = 0,
  musicLoops = 0;
let active = 0,
  transitionAt: number | null = null,
  switchMs: number | null = null;
let lastError = "немає",
  faulty = false;
let lastPlayingIndex = 0;
const player = new TvPlayback(videos, music, playlist, (message) => {
  status.textContent = message;
});
player.updateSettings(settings);
// Listeners precede the player's next() call via capture, measuring ended -> incoming playing.
videos.forEach((video, slot) => {
  video.addEventListener(
    "ended",
    () => {
      if (slot === active) transitionAt = performance.now();
    },
    true,
  );
  video.addEventListener("playing", () => {
    if (slot !== active) {
      // The engine has already prepared the outgoing slot with a future source.
      // Compare with the last actually playing index, not that slot's new dataset.
      if (Number(video.dataset["index"]) < lastPlayingIndex) loops++;
      active = slot;
      switches++;
      switchMs = transitionAt === null ? null : performance.now() - transitionAt;
      transitionAt = null;
    }
    lastPlayingIndex = Number(video.dataset["index"]);
    render();
  });
});
[...videos, music].forEach((media) =>
  media.addEventListener("error", () => {
    errors++;
    lastError = `${media.tagName} code=${media.error?.code ?? "?"} ${media.getAttribute("src")}`;
    render();
  }),
);
music.addEventListener("ended", () => {
  musicLoops++;
});
function button(label: string, click: () => void) {
  const element = document.createElement("button");
  element.textContent = label;
  element.addEventListener("click", click);
  controls.append(element);
}
button("▶ Зі звуком / продовжити", () => player.start(true));
button("Звук ON/OFF", () => player.toggleSound());
button("Наступний", () => {
  transitionAt = performance.now();
  player.next();
});
for (const [key, label] of [
  ["musicVolume", "Музика"],
  ["videoVolume", "Відео"],
  ["duckVolume", "Ducking"],
] as const) {
  for (const delta of [-0.1, 0.1])
    button(`${label} ${delta < 0 ? "−" : "+"}`, () => {
      settings[key] = Math.max(0, Math.min(1, Math.round((settings[key] + delta) * 100) / 100));
      player.updateSettings(settings);
      render();
    });
}
button("Помилка наступного / відновити список", () => {
  faulty = !faulty;
  const brokenIndex = (Number(videos[active]!.dataset["index"] || 0) + 1) % playlist.length;
  player.updatePlaylist(
    playlist.map((item, index) =>
      faulty && index === brokenIndex
        ? { ...item, url: "https://example.invalid/smile-media-test-unavailable.mp4" }
        : item,
    ),
  );
  render();
});
function render() {
  const current = videos[active]!,
    next = videos[1 - active]!;
  const title = (v: HTMLVideoElement) => playlist[Number(v.dataset["index"])]?.title || "—";
  diagnostics.textContent = [
    `Поточний: ${title(current)} · slot ${active + 1} · ${current.currentTime.toFixed(1)}s`,
    `Наступний: ${title(next)} · readyState ${next.readyState} · preload=${next.preload} · buffered=${next.buffered.length}`,
    `Перемикання: ${switches} · цикли: ${loops} · ended/next → playing: ${switchMs === null ? "—" : switchMs.toFixed(1) + " ms"}`,
    `Помилки: ${errors} · тест несправності: ${faulty ? "ON" : "OFF"} · ${lastError}`,
    `Музика: ${music.error ? "ERROR" : music.paused ? "PAUSED" : "PLAYING"} · ${music.currentTime.toFixed(1)}s · цикли ${musicLoops} · muted=${music.muted}`,
    `Гучність: music=${settings.musicVolume.toFixed(2)} actual=${music.volume.toFixed(2)} · video=${current.volume.toFixed(2)} muted=${current.muted} · duck=${settings.duckVolume.toFixed(2)}`,
  ].join("\n");
}
const timer = setInterval(render, 250);
render();
window.addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter"].includes(event.key)) return;
  const buttons = Array.from(controls.querySelectorAll("button"));
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (event.key === "Enter" && index >= 0) return;
  event.preventDefault();
  const delta = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
  buttons[index < 0 ? 0 : (index + delta + buttons.length) % buttons.length]?.focus();
});
window.addEventListener(
  "pagehide",
  () => {
    clearInterval(timer);
    player.dispose();
  },
  { once: true },
);
controls.querySelector("button")?.focus();
