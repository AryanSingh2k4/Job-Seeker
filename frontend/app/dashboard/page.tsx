"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, Bot, Database, KeyRound, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import type { Health } from "@/lib/api/types";
import { useLiveRun } from "@/lib/stores/liveRun";
import { CountUp, GlassCard, PageIn, ProgressRing, Rise, Stagger, SPRING } from "@/components/motion";
import { cn } from "@/lib/utils";

function StatusCard({
  icon: Icon,
  label,
  value,
  ok,
  pending,
}: {
  icon: typeof Database;
  label: string;
  value: string;
  ok?: boolean;
  pending?: boolean;
}) {
  return (
    <Rise>
      <GlassCard className="group p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">{label}</span>
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-lg border transition-colors",
              ok
                ? "border-score-high/25 bg-score-high/10 text-score-high"
                : pending
                  ? "border-border bg-surface-2 text-muted"
                  : "border-gate-fail/25 bg-gate-fail/10 text-gate-fail",
            )}
          >
            <Icon className="size-3.5" />
          </span>
        </div>
        <div
          className={cn(
            "mt-3 text-lg font-semibold tracking-tight",
            ok ? "text-score-high" : pending ? "text-muted" : "text-gate-fail",
          )}
        >
          {value}
        </div>
      </GlassCard>
    </Rise>
  );
}

function Funnel() {
  const stages = [
    { label: "Discovered", value: 312, w: 100 },
    { label: "Scored ≥65", value: 96, w: 31 },
    { label: "Tailored", value: 41, w: 13 },
    { label: "Applied", value: 12, w: 4 },
  ];
  return (
    <GlassCard hover={false} className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4 text-accent" /> Pipeline · last 7 days
        </div>
        <span className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted">demo data</span>
      </div>
      <div className="space-y-3">
        {stages.map((s, i) => (
          <div key={s.label}>
            <div className="mb-1 flex justify-between text-[11px]">
              <span className="text-muted">{s.label}</span>
              <span className="tnum text-text">{s.value}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-accent to-accent-hover"
                initial={{ width: 0 }}
                animate={{ width: `${s.w}%` }}
                transition={{ ...SPRING, delay: 0.15 + i * 0.08, damping: 30 }}
                style={{ boxShadow: "0 0 12px -2px #e3b34c88" }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-white/5 pt-3 text-[11px] text-muted">
        reply tracking arrives with analytics (M6)
      </div>
    </GlassCard>
  );
}

const STAGE_INDEX: Record<string, number> = {
  NAVIGATING: 0,
  FILLING_FIELDS: 1,
  UPLOADING_RESUME: 2,
  ANSWERING_QA: 3,
  PAUSED_FOR_REVIEW: 4,
  SUBMITTED: 5,
  FAILED: 5,
};
const STAGE_LABELS = ["NAVIGATING", "FILLING", "UPLOADING", "ANSWERING", "REVIEW", "SUBMITTED"] as const;

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
  const activeIdx = stage ? (STAGE_INDEX[stage.stage] ?? -1) : -1;
  const failed = stage?.stage === "FAILED";

  return (
    <PageIn className="mx-auto max-w-6xl">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="display text-[30px] font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Every subsystem, at a glance.</p>
        </div>
        <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-1.5 text-[11px] text-muted">
          sidecar <span className="tnum text-text">{h?.version ?? "—"}</span> · contract{" "}
          <span className="tnum text-text">v{h?.contract_version ?? "1"}</span>
        </div>
      </div>

      {q.isError && (
        <Rise className="mt-6">
          <div className="rounded-xl border border-gate-fail/25 bg-gate-fail/5 p-4 text-sm text-gate-fail">
            Backend unreachable. Start the sidecar (Gemini&apos;s M0) or fixture mode via{" "}
            <code className="font-mono text-xs">.env.development</code>.
          </div>
        </Rise>
      )}

      {q.isLoading && (
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-[110px]" />
          ))}
        </div>
      )}

      {h && (
        <Stagger className="mt-6" gap={0.07}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatusCard icon={Activity} label="Backend" value={h.status === "ok" ? "healthy" : h.status} ok={h.status === "ok"} />
            <StatusCard icon={Database} label="Database" value={h.db ? "SQLite · WAL" : "down"} ok={h.db} />
            <StatusCard icon={Bot} label="Automation browser" value={h.browser.running ? "running" : "not running"} ok={h.browser.running} pending={!h.browser.running} />
            <StatusCard icon={KeyRound} label="LLM" value={h.llm.degraded ? "degraded" : h.llm.configured ? "configured" : "no key"} ok={h.llm.configured && !h.llm.degraded} pending={!h.llm.configured} />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <Rise className="lg:col-span-2">
              <GlassCard hover={false} className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Activity className="size-4 text-accent" /> Daily caps
                  </div>
                  <span className="text-[11px] text-muted">resets midnight</span>
                </div>
                <div className="flex items-center justify-around py-2">
                  <div className="flex flex-col items-center gap-2">
                    <ProgressRing value={h.caps_today.linkedin.used} max={h.caps_today.linkedin.limit} size={84} label={`of ${h.caps_today.linkedin.limit}`} />
                    <span className="text-xs text-muted">LinkedIn</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <ProgressRing value={h.caps_today.ats.used} max={h.caps_today.ats.limit} size={84} tone="var(--color-accent)" label={`of ${h.caps_today.ats.limit}`} />
                    <span className="text-xs text-muted">Direct ATS</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <ProgressRing value={h.caps_today.linkedin.used + h.caps_today.ats.used} max={20} size={84} tone="var(--color-prov-deterministic)" label="of 20" />
                    <span className="text-xs text-muted">Global</span>
                  </div>
                </div>
              </GlassCard>
            </Rise>

            <Rise>
              <Funnel />
            </Rise>
          </div>

          <Rise className="mt-5">
            <GlassCard hover={false} className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-accent" />
                  </span>
                  Live run
                </div>
                <span className="text-[11px] text-muted">telemetry {wsStatus}</span>
              </div>
              {stage ? (
                <div>
                  <div className="text-sm font-medium">
                    {stage.company} <span className="text-muted">· step {stage.currentStep}/{stage.totalSteps}</span>
                  </div>
                  <div className="mt-4 flex items-center">
                    {STAGE_LABELS.map((s, i) => (
                      <div key={s} className="flex flex-1 items-center last:flex-none">
                        <div className="flex flex-col items-center gap-1.5">
                          <motion.div
                            initial={false}
                            animate={{
                              scale: i === activeIdx ? 1.15 : 1,
                              backgroundColor:
                                failed && i >= 4
                                  ? "var(--color-gate-fail)"
                                  : i <= activeIdx
                                    ? "var(--color-accent)"
                                    : "#1d2836",
                            }}
                            className={cn("size-3 rounded-full", i === activeIdx && (failed ? "shadow-[0_0_18px_-4px_#f87171]" : "shadow-glow"))}
                          />
                          <span className={cn("text-[9px]", i <= activeIdx ? "text-text" : "text-muted")}>{s}</span>
                        </div>
                        {i < STAGE_LABELS.length - 1 && (
                          <div className="mx-1 h-px flex-1 bg-gradient-to-r from-accent/50 to-border" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-2 text-sm text-muted">
                  No active run — the automation browser is idle. Approve a job to see it fill live.
                </div>
              )}
            </GlassCard>
          </Rise>
        </Stagger>
      )}
    </PageIn>
  );
}
