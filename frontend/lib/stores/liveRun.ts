"use client";

/*
 * Zustand stores (FINAL_EXECUTION_PLAN §4): liveRunStore, toastStore, wsStatus.
 * Week 0 keeps them minimal — WS events land here; screens subscribe.
 */

import { create } from "zustand";
import { telemetry } from "@/lib/ws/client";
import type { TelemetryEvent, WsStatus } from "@/lib/ws/client";

export interface Toast {
  id: number;
  kind: "info" | "hitl" | "captcha" | "error";
  message: string;
}

interface LiveRunState {
  wsStatus: WsStatus;
  lastEvent: TelemetryEvent | null;
  events: TelemetryEvent[];        // ring buffer (last 50)
  reviewPending: number;           // HITL_REVIEW_REQUIRED count not yet cleared
  toasts: Toast[];
  setWsStatus: (s: WsStatus) => void;
  pushEvent: (e: TelemetryEvent) => void;
  clearReviewPending: () => void;
  pushToast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
}

let toastId = 0;
const MAX_EVENTS = 50;

export const useLiveRun = create<LiveRunState>((set) => ({
  wsStatus: "idle",
  lastEvent: null,
  events: [],
  reviewPending: 0,
  toasts: [],
  setWsStatus: (wsStatus) => set({ wsStatus }),
  pushEvent: (e) =>
    set((s) => {
      const update: Partial<LiveRunState> = {
        lastEvent: e,
        events: [...s.events.slice(-(MAX_EVENTS - 1)), e],
      };
      if (e.type === "HITL_REVIEW_REQUIRED") {
        update.reviewPending = s.reviewPending + 1;
        update.toasts = [
          ...s.toasts,
          { id: ++toastId, kind: "hitl", message: `Review needed: ${e.payload.company} — ${e.payload.title}` },
        ];
      } else if (e.type === "CAPTCHA_CHALLENGE_DETECTED") {
        update.toasts = [
          ...s.toasts,
          { id: ++toastId, kind: "captcha", message: `Security check on ${e.payload.company} — solve it in the automation browser window` },
        ];
      }
      return update;
    }),
  clearReviewPending: () => set({ reviewPending: 0 }),
  pushToast: (t) => set((s) => ({ toasts: [...s.toasts, { ...t, id: ++toastId }] })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Wire the singleton socket into the store. Call once from AppShell. */
export function bindTelemetry(): () => void {
  const offEvent = telemetry.onEvent((e) => useLiveRun.getState().pushEvent(e));
  const offStatus = telemetry.onStatus((s) => useLiveRun.getState().setWsStatus(s));
  void telemetry.start();
  return () => {
    offEvent();
    offStatus();
    telemetry.stop();
  };
}
