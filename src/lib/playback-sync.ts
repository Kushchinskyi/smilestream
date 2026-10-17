// One bounded request at a time per resource. No Realtime channels to duplicate.
export function startPolling<T>(
  read: (signal: AbortSignal) => Promise<T>,
  accept: (value: T) => void,
  failure: () => void,
  interval = 10000,
) {
  let stopped = false;
  let busy = false;
  let rerun = false;
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout>;
  let deadline: ReturnType<typeof setTimeout>;
  async function refresh() {
    if (stopped) return;
    if (busy) {
      rerun = true;
      return;
    }
    clearTimeout(timer);
    busy = true;
    controller = new AbortController();
    const current = controller;
    const timeout = setTimeout(() => current.abort(), 12000);
    deadline = timeout;
    try {
      const value = await read(current.signal);
      if (!stopped && !current.signal.aborted) accept(value);
    } catch {
      if (!stopped) failure();
    } finally {
      clearTimeout(timeout);
      busy = false;
      if (!stopped) {
        const delay = rerun ? 0 : interval;
        rerun = false;
        timer = setTimeout(() => {
          void refresh();
        }, delay);
      }
    }
  }
  const visible = () => {
    if (!document.hidden) void refresh();
  };
  const online = () => {
    void refresh();
  };
  window.addEventListener("online", online);
  document.addEventListener("visibilitychange", visible);
  void refresh();
  return () => {
    stopped = true;
    clearTimeout(timer);
    clearTimeout(deadline);
    controller?.abort();
    window.removeEventListener("online", online);
    document.removeEventListener("visibilitychange", visible);
  };
}
