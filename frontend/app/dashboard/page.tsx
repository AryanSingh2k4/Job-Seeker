"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import type { Health } from "@/lib/api/types";
import { useLiveRun } from "@/lib/stores/liveRun";

function Card({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

function CapMeter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const tone = pct >= 100 ? "bg-gate-fail" : pct >= 80 ? "bg-score-mid" : "bg-score-high";
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span>
          {used} / {limit}
        </span>
      </div>
      <div className="h-2 rounded bg-surface-2">
        <div className={`h-2 rounded ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const wsStatus = useLiveRun((s) => s.wsStatus);
  const lastEvent = useLiveRun((s) => s.lastEvent);
  const q = useQuery<Health>({
    queryKey: ["health"],
    queryFn: () => apiFetch<Health>("/health"),
    refetchInterval: 10_000,
  });

  const h = q.data;
  const stage = lastEvent?.type === "APPLICATION_STAGE_CHANGED" ? lastEvent.payload : null;

  return (
    <section className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-muted">
        Week 0 build — live against the sidecar contract. Backend milestones land M0 → M6.
      </p>

      {q.isError && (
        <div className="mt-6 rounded-lg border border-gate-fail/40 bg-gate-fail/10 p-4 text-sm text-gate-fail">
          Backend unreachable at the configured address. Start the sidecar (Gemini&apos;s M0) or
          run dev with <code className="font-mono">NEXT_PUBLIC_MSW=1</code> for fixture mode.
        </div>
      )}

      {h && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card label="Backend" value={h.status === "ok" ? "healthy" : h.status}
              tone={h.status === "ok" ? "text-score-high" : "text-gate-fail"} />
            <Card label="Database" value={h.db ? "SQLite (WAL) ok" : "down"}
              tone={h.db ? "text-score-high" : "text-gate-fail"} />
            <Card label="Automation browser" value={h.browser.running ? "running" : "not running"}
              tone={h.browser.running ? "text-score-high" : "text-muted"} />
            <Card label="LLM" value={h.llm.degraded ? "degraded (local)" : h.llm.configured ? "configured" : "no key"}
              tone={h.llm.degraded ? "text-score-mid" : h.llm.configured ? "text-score-high" : "text-muted"} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-3 text-sm font-medium">Daily caps</div>
              <div className="space-y-3">
                <CapMeter label="LinkedIn Easy Apply" used={h.caps_today.linkedin.used} limit={h.caps_today.linkedin.limit} />
                <CapMeter label="Direct ATS" used={h.caps_today.ats.used} limit={h.caps_today.ats.limit} />
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-3 text-sm font-medium">Live run strip</div>
              {stage ? (
                <div className="text-sm">
                  <div className="text-text">
                    {stage.company} — step {stage.currentStep}/{stage.totalSteps}
                  </div>
                  <div className="mt-1 text-accent">{stage.stage}</div>
                </div>
              ) : (
                <div className="text-sm text-muted">
                  No active run. Telemetry: {wsStatus}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 text-xs text-muted">
            sidecar v{h.version} · contract v{h.contract_version}
          </div>
        </>
      )}
    </section>
  );
}
