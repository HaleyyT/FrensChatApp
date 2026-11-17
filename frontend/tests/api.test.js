import { afterEach, expect, test, vi } from "vitest";
import { apiRequest, getMessages } from "../src/lib/api";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

test("API requests retain cookie credentials, pagination, and structured error data", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    error: { code: "INVALID_CURSOR", message: "Invalid cursor", details: { field: "before" } },
  }), { status: 400 }));
  vi.stubGlobal("fetch", fetch);
  await expect(getMessages("peer", { limit: 2, before: "2026-11-18T00:00:00.000Z" })).rejects.toMatchObject({
    status: 400, code: "INVALID_CURSOR", details: { field: "before" },
  });
  const [url, options] = fetch.mock.calls[0];
  expect(new URL(url).searchParams.get("before")).toBe("2026-11-18T00:00:00.000Z");
  expect(new URL(url).searchParams.get("limit")).toBe("2");
  expect(options.credentials).toBe("include");
});

test("an unresponsive request aborts and surfaces a stable timeout code", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn((_, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  })));
  const result = expect(apiRequest("/auth/me", { timeoutMs: 20 })).rejects.toMatchObject({ code: "REQUEST_TIMEOUT" });
  await vi.advanceTimersByTimeAsync(20);
  await result;
  expect(vi.getTimerCount()).toBe(0);
});

test("a deployed frontend with a missing API URL performs no network requests", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("window", { location: { hostname: "chat.invalid" } });
  vi.stubEnv("VITE_API_BASE_URL", "");
  const api = await import("../src/lib/api");
  await expect(api.getCurrentUser()).rejects.toMatchObject({ code: "FRONTEND_CONFIG_ERROR" });
  expect(fetch).not.toHaveBeenCalled();
});

test("a deployed build uses its configured backend origin", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ _id: "member" })));
  vi.stubGlobal("fetch", fetch);
  vi.stubEnv("VITE_API_BASE_URL", "https://api.chat.invalid/api");
  const api = await import("../src/lib/api");
  await expect(api.getCurrentUser()).resolves.toEqual({ _id: "member" });
  expect(fetch.mock.calls[0][0]).toBe("https://api.chat.invalid/api/auth/me");
});

test("a non-JSON gateway error surfaces an HTTP status and safe default message", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>unavailable</html>", { status: 502 })));
  await expect(apiRequest("/auth/me")).rejects.toMatchObject({ status: 502, message: "Request failed" });
});
