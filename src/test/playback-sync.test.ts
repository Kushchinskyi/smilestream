import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startPolling } from "@/lib/playback-sync";

describe("settings and playlist synchronization lifecycle", () => {
  const stops: (() => void)[] = [];
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    stops.splice(0).forEach((stop) => stop());
    vi.useRealTimers();
  });
  it("polls updated settings automatically and cleans up on remount", async () => {
    const accept = vi.fn();
    const read = vi
      .fn()
      .mockResolvedValueOnce({ musicVolume: 0.3 })
      .mockResolvedValue({ musicVolume: 0.7 });
    const stop = startPolling(read, accept, vi.fn());
    stops.push(stop);
    await vi.advanceTimersByTimeAsync(10000);
    expect(accept.mock.calls.map((c) => c[0].musicVolume)).toEqual([0.3, 0.7]);
    stop();
    const count = read.mock.calls.length;
    stops.push(startPolling(read, accept, vi.fn()));
    await vi.advanceTimersByTimeAsync(10000);
    expect(read.mock.calls.length).toBe(count + 2);
  });
  it("keeps the last good snapshot through an outage and refreshes on online", async () => {
    const accept = vi.fn(),
      failure = vi.fn();
    const read = vi
      .fn()
      .mockResolvedValueOnce(["old"])
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(["new"]);
    stops.push(startPolling(read, accept, failure));
    await vi.advanceTimersByTimeAsync(10000);
    expect(accept).toHaveBeenCalledTimes(1);
    expect(failure).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(accept).toHaveBeenLastCalledWith(["new"]);
  });
  it("coalesces repeated reconnects without overlapping requests", async () => {
    let resolve!: (value: number) => void;
    const read = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<number>((r) => {
            resolve = r;
          }),
      )
      .mockResolvedValue(2);
    const accept = vi.fn();
    stops.push(startPolling(read, accept, vi.fn()));
    for (let i = 0; i < 20; i++) window.dispatchEvent(new Event("online"));
    expect(read).toHaveBeenCalledTimes(1);
    resolve(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(read).toHaveBeenCalledTimes(2);
    expect(accept.mock.calls.map((c) => c[0])).toEqual([1, 2]);
  });
  it("aborts timed out requests and retries", async () => {
    const failure = vi.fn();
    const read = vi.fn(
      (signal: AbortSignal) =>
        new Promise<number>((_resolve, reject) =>
          signal.addEventListener("abort", () => reject(new Error("timeout"))),
        ),
    );
    stops.push(startPolling(read, vi.fn(), failure));
    await vi.advanceTimersByTimeAsync(22000);
    expect(failure).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("ignores late results and removes reconnect listeners after disposal", async () => {
    let resolve!: (value: number) => void;
    let signal!: AbortSignal;
    const read = vi.fn((s: AbortSignal) => {
      signal = s;
      return new Promise<number>((r) => {
        resolve = r;
      });
    });
    const accept = vi.fn(),
      failure = vi.fn();
    const stop = startPolling(read, accept, failure);
    stops.push(stop);
    stop();
    expect(signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    resolve(1);
    await vi.advanceTimersByTimeAsync(30000);
    window.dispatchEvent(new Event("online"));
    expect(accept).not.toHaveBeenCalled();
    expect(failure).not.toHaveBeenCalled();
    expect(read).toHaveBeenCalledTimes(1);
  });
});
