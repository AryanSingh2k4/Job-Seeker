/*
 * Bootstrap resolution — how the dashboard finds the Python sidecar.
 *
 * Desktop (Tauri): the Rust shell spawns the sidecar, reads the
 * `AUTOJOB_READY {"port":..,"token":..}` stdout handshake, and exposes it via
 * the `get_bootstrap` IPC command. We invoke it once, cache it on
 * window.__JOBSEEKER_BOOTSTRAP__, and use it for every API/WS call.
 *
 * Web dev (`next dev`): no Tauri → fall back to http://127.0.0.1:8000 with no
 * bearer token (dev mode is unauthenticated per BACKEND_IMPLEMENTATION_SPEC §7).
 */

export interface Bootstrap {
  port: number;
  token: string;
  pid: number;
  version: string;
  kind?: string; // "stub" during Week 0 / D0
}

declare global {
  interface Window {
    __JOBSEEKER_BOOTSTRAP__?: Bootstrap;
    __TAURI__?: {
      core?: { invoke<T>(cmd: string, args?: unknown): Promise<T> };
      invoke?: <T>(cmd: string, args?: unknown) => Promise<T>;
    };
  }
}

let resolved: Promise<{ baseUrl: string; token?: string }> | null = null;

function invoke<T>(cmd: string): Promise<T> | undefined {
  const t = window.__TAURI__;
  if (t?.core?.invoke) return t.core.invoke<T>(cmd);
  if (t?.invoke) return t.invoke<T>(cmd);
  return undefined;
}

export function ensureApi(): Promise<{ baseUrl: string; token?: string }> {
  if (typeof window === "undefined") {
    return Promise.resolve({ baseUrl: "http://127.0.0.1:8000" });
  }
  if (!resolved) {
    resolved = (async () => {
      if (window.__JOBSEEKER_BOOTSTRAP__) {
        const b = window.__JOBSEEKER_BOOTSTRAP__;
        return { baseUrl: `http://127.0.0.1:${b.port}`, token: b.token };
      }
      const inv = invoke;
      if (inv) {
        try {
          const b = await inv<Bootstrap>("get_bootstrap");
          if (!b) throw new Error("bootstrap unavailable");
          window.__JOBSEEKER_BOOTSTRAP__ = b;
          return { baseUrl: `http://127.0.0.1:${b.port}`, token: b.token };
        } catch {
          // sidecar not ready yet — fall through to dev default
        }
      }
      return { baseUrl: "http://127.0.0.1:8000" };
    })();
  }
  return resolved;
}
