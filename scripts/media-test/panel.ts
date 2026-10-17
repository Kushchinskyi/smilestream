// UI only: showing/hiding diagnostics never calls the playback engine.
export function attachDiagnosticPanel(panel: HTMLElement, videos: HTMLVideoElement[]) {
  let started = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const buttons = () =>
    Array.from(panel.querySelectorAll<HTMLButtonElement>("button:not([disabled])"));
  function arm() {
    clearTimeout(timer);
    if (started && !panel.hidden) timer = setTimeout(hide, 5000);
  }
  function hide() {
    clearTimeout(timer);
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && panel.contains(focused)) focused.blur();
    panel.hidden = true;
  }
  function show(focus: boolean) {
    panel.hidden = false;
    if (focus) buttons()[0]?.focus();
    arm();
  }
  function playing() {
    if (started) return; // Clip changes/recovery must not reveal the panel or reset idle time.
    started = true;
    arm();
  }
  function keydown(event: KeyboardEvent) {
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
    const arrow = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(key || "");
    arm();
    if (!arrow && key !== "Enter") return;
    if (panel.hidden) {
      event.preventDefault();
      show(true);
      return;
    }
    const available = buttons();
    const index = available.indexOf(document.activeElement as HTMLButtonElement);
    if (key === "Enter" && index >= 0) return; // Native OK/click activates exactly once.
    event.preventDefault();
    const delta = key === "ArrowLeft" || key === "ArrowUp" ? -1 : 1;
    available[index < 0 ? 0 : (index + delta + available.length) % available.length]?.focus();
  }
  function mouse(event: Event) {
    // Hover/movement must not uncover diagnostics over video on TV pointer remotes.
    if (panel.hidden && ["mousedown", "click", "touchstart"].includes(event.type)) show(false);
    else arm();
  }
  const mouseEvents = ["mousemove", "mousedown", "click", "wheel", "touchstart"] as const;
  window.addEventListener("keydown", keydown);
  // Capture resets the timer before a Hide button's click clears it again.
  mouseEvents.forEach((name) => window.addEventListener(name, mouse, true));
  videos.forEach((video) => video.addEventListener("playing", playing));
  show(true);
  return {
    hide,
    dispose() {
      clearTimeout(timer);
      window.removeEventListener("keydown", keydown);
      mouseEvents.forEach((name) => window.removeEventListener(name, mouse, true));
      videos.forEach((video) => video.removeEventListener("playing", playing));
    },
  };
}
