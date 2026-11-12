/*
 * Telemetry WebSocket client — frozen protocol (BACKEND_IMPLEMENTATION_SPEC §8).
 * Server push only; client sends PING keepalives and RESYNC on (re)connect.
 * The server replays its last-50 ring buffer on RESYNC.
 */

import { ensureApi } from "@/lib/bootstrap";

export type TelemetryEvent =
  | { type: "APPLICATION_STAGE_CHANGED"; payload: {
      applicationId: string; jobId: string; company: string;
      stage: "NAVIGATING" | "FILLING_FIELDS" | "UPLOADING_RESUME" | "ANSWERING_QA"
        | "PAUSED_FOR_REVIEW" | "SUBMITTED" | "FAILED";
      currentStep: number; totalSteps: number; } }
  | { type: "HITL_REVIEW_REQUIRED"; payload: {
      applicationId: string; company: string; title: string;
      tailoredResumePdfUrl: string;
      qaAnswers: Array<{ question: string; answer: string; confidence: number }>; } }
  | { type: "CAPTCHA_CHALLENGE_DETECTED"; payload: {
      applicationId: string; company: string;
      captchaType: "CLOUDFLARE_TURNSTILE" | "RECAPTCHA" | "ARKOSE_PUZZLE"; } }
  | { type: "RATE_LIMIT_UPDATE"; payload: {
      dailyLinkedInUsed: number; dailyLinkedInLimit: number;
      dailyATSUsed: number; dailyATSLimit: number; resetsAt: string; } }
  | { type: "SWEEP_COMPLETED"; payload: {
      sweepId: string; new_jobs: number; duplicate: number; filtered: number; } };

export type WsStatus = "idle" | "connecting" | "open" | "closed";

type Listener = (event: TelemetryEvent) => void;
type StatusListener = (status: WsStatus) => void;

class TelemetrySocket {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private statusListeners = new Set<StatusListener>();
  private retry = 0;
  private keepalive: ReturnType<typeof setInterval> | null = null;
  private stopped = true;

  onEvent(l: Listener) { this.listeners.add(l); return () => this.listeners.delete(l); }
  onStatus(l: StatusListener) { this.statusListeners.add(l); return () => this.statusListeners.delete(l); }

  private setStatus(s: WsStatus) { this.statusListeners.forEach((l) => l(s)); }

  async start() {
    if (!this.stopped) return;
    this.stopped = false;
    await this.connect();
  }

  stop() {
    this.stopped = true;
    if (this.keepalive) clearInterval(this.keepalive);
    this.ws?.close();
    this.ws = null;
    this.setStatus("idle");
  }

  private async connect() {
    if (this.stopped) return;
    this.setStatus("connecting");
    const { baseUrl, token } = await ensureApi();
    const wsBase = baseUrl.replace(/^http/, "ws");
    const url = token ? `${wsBase}/ws/telemetry?token=${encodeURIComponent(token)}` : `${wsBase}/ws/telemetry`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.retry = 0;
      this.setStatus("open");
      ws.send(JSON.stringify({ type: "RESYNC" }));
      this.keepalive = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "PING" }));
      }, 25_000);
    };

    ws.onmessage = (msg) => {
      try {
        // Server frames are contract events; PONG is the keepalive reply.
        const raw = JSON.parse(String(msg.data)) as { type?: string };
        if (!raw?.type || raw.type === "PONG") return;
        this.listeners.forEach((l) => l(raw as unknown as TelemetryEvent));
      } catch { /* malformed frame — ignore */ }
    };

    ws.onclose = () => {
      if (this.keepalive) clearInterval(this.keepalive);
      this.keepalive = null;
      if (!this.stopped) {
        this.setStatus("closed");
        this.scheduleReconnect();
      }
    };
    ws.onerror = () => ws.close();
  }

  private scheduleReconnect() {
    const delay = Math.min(30_000, 1000 * 2 ** this.retry++);
    setTimeout(() => this.connect(), delay);
  }
}

export const telemetry = new TelemetrySocket();
