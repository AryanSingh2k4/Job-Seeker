import { ensureApi } from "@/lib/bootstrap";
import { ApiError } from "./types";
import type { ApiErrorEnvelope } from "./types";

/**
 * Typed fetch wrapper for the frozen contract (BACKEND_IMPLEMENTATION_SPEC §7).
 * - Resolves base URL + bearer token from the Tauri bootstrap (or dev default).
 * - Unwraps the error envelope into ApiError on any non-2xx.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { baseUrl, token } = await ensureApi();
  // Contract prefix: all public routes live under /api/v1 (spec §7).
  // baseUrl is the sidecar origin (no /api/v1) so the WS client can reuse it.
  const res = await fetch(`${baseUrl}/api/v1${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let code = `http_${res.status}`;
    let message = res.statusText;
    try {
      const body = (await res.json()) as ApiErrorEnvelope;
      if (body?.error?.code) {
        code = body.error.code;
        message = body.error.message;
      }
    } catch {
      /* non-JSON error body — keep defaults */
    }
    throw new ApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}
