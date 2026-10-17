import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { attachDiagnosticPanel } from "../../scripts/media-test/panel";

let ui: ReturnType<typeof attachDiagnosticPanel>;
let panel: HTMLElement;
let videos: HTMLVideoElement[];
let buttons: HTMLButtonElement[];
const key = (value: string) =>
  window.dispatchEvent(new KeyboardEvent("keydown", { key: value, cancelable: true }));
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML =
    "<video></video><video></video><audio></audio><section><p>diagnostics</p><button disabled>disabled</button><button>start</button><button>next</button><button>hide</button></section>";
  panel = document.querySelector("section")!;
  videos = Array.from(document.querySelectorAll("video"));
  buttons = Array.from(panel.querySelectorAll("button:not([disabled])"));
  ui = attachDiagnosticPanel(panel, videos);
  buttons[2]!.addEventListener("click", ui.hide);
});
afterEach(() => {
  ui.dispose();
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.restoreAllMocks();
});
function start() {
  videos[0]!.dispatchEvent(new Event("playing"));
}
it("keeps start controls visible before playback, then hides the whole panel after five seconds and blurs focus", () => {
  vi.advanceTimersByTime(10000);
  expect(panel.hidden).toBe(false);
  expect(document.activeElement).toBe(buttons[0]);
  start();
  vi.advanceTimersByTime(4999);
  expect(panel.hidden).toBe(false);
  vi.advanceTimersByTime(1);
  expect(panel.hidden).toBe(true);
  expect(panel.contains(document.activeElement)).toBe(false);
});
it.each(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"])(
  "%s reveals hidden panel and focuses first enabled button without skipping it",
  (arrow) => {
    start();
    ui.hide();
    key(arrow);
    expect(panel.hidden).toBe(false);
    expect(document.activeElement).toBe(buttons[0]);
    key("ArrowRight");
    expect(document.activeElement).toBe(buttons[1]);
    key("ArrowLeft");
    expect(document.activeElement).toBe(buttons[0]);
    key("ArrowLeft");
    expect(document.activeElement).toBe(buttons[2]);
    vi.advanceTimersByTime(5000);
    expect(panel.hidden).toBe(true);
  },
);
it("resets inactivity on remote keys and mouse activity", () => {
  start();
  for (const event of [
    new KeyboardEvent("keydown", { key: "Enter" }),
    new KeyboardEvent("keydown", { key: "MediaPlayPause" }),
    new MouseEvent("mousemove"),
    new MouseEvent("mousedown"),
    new MouseEvent("click"),
    new WheelEvent("wheel"),
  ]) {
    vi.advanceTimersByTime(4000);
    window.dispatchEvent(event);
    expect(panel.hidden).toBe(false);
  }
  vi.advanceTimersByTime(4999);
  expect(panel.hidden).toBe(false);
  vi.advanceTimersByTime(1);
  expect(panel.hidden).toBe(true);
  window.dispatchEvent(new MouseEvent("mousemove"));
  expect(panel.hidden).toBe(true);
  window.dispatchEvent(new MouseEvent("mousedown"));
  expect(panel.hidden).toBe(false);
});
it("manual Hide stays hidden after bubbling click; OK navigation works after revealing again", () => {
  start();
  buttons[2]!.focus();
  buttons[2]!.click();
  expect(panel.hidden).toBe(true);
  expect(panel.contains(document.activeElement)).toBe(false);
  key("ArrowDown");
  const click = vi.fn();
  buttons[0]!.addEventListener("click", click);
  const nativeOk = new KeyboardEvent("keydown", { key: "Enter", cancelable: true, bubbles: true });
  buttons[0]!.dispatchEvent(nativeOk);
  expect(nativeOk.defaultPrevented).toBe(false);
  buttons[0]!.click(); // Browser's default Enter activation (not simulated by jsdom).
  expect(click).toHaveBeenCalledTimes(1);
});
it("supports legacy Samsung key codes, leaves media untouched and does not reset on clip transitions", () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, "play");
  const pause = vi.spyOn(HTMLMediaElement.prototype, "pause");
  const load = vi.spyOn(HTMLMediaElement.prototype, "load");
  start();
  vi.advanceTimersByTime(4000);
  videos[1]!.dispatchEvent(new Event("playing"));
  vi.advanceTimersByTime(1000);
  expect(panel.hidden).toBe(true);
  window.dispatchEvent(new KeyboardEvent("keydown", { keyCode: 39, cancelable: true }));
  expect(document.activeElement).toBe(buttons[0]);
  ui.hide();
  videos[0]!.dispatchEvent(new Event("playing"));
  expect(panel.hidden).toBe(true);
  expect(play).not.toHaveBeenCalled();
  expect(pause).not.toHaveBeenCalled();
  expect(load).not.toHaveBeenCalled();
});
it("cleans up timers and listeners on dispose", () => {
  start();
  ui.dispose();
  ui.hide();
  key("ArrowUp");
  expect(panel.hidden).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
