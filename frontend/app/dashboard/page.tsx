"use client";

/*
 * Dashboard v4 — bento composition. Hero band, asymmetric glass grid,
 * live-run strip. All data from the frozen contract; funnel labeled demo.
 */

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, Bot, Database, KeyRound, ArrowUpRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api/client";
import type { Health } from "@/lib/api/types";
import { useLiveRun } from "@/lib/stores/liveRun";
import { CountUp, GlassCard, PageIn, ProgressRing, Rise, Stagger, SPRING } from "@/components/motion";
import { cn } from "@/lib/utils";

const STAGE_LABELS = ["NAVIGATING", "FILLING", "UPLOADING", "ANSWERING", "REVIEW", "SUBMITTED"] as const;
const STAGE_INDEX: Record<string, number> = {
  NAVIGATING: 0, FILLING_FIELDS: 1, UPLOADING_RESUME: 2, ANSWERING_QA: 3,
  PAUSED_FOR_REVIEW: 4, SUBMITTED: 5, FAILED: 5,
};

function StatusCell({
  icon: Icon, label, value, ok, pending,
}: {
  icon: typeof Database; label: string; value: string; ok?: boolean; pending?: boolean;
}) {
  return (
    <div className="flex items-center gap-3.5">
      <span
        className={cn(
          "flex size-10 items-center justify-center rounded-xl border transition-colors",
          ok ? "border-pos/25 bg-pos/10 text-pos" : pending ? "border-border bg-surface-2 text-muted" : "border-neg/25 bg-neg/10 text-neg",
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] text-muted">{label}</div>
        <div className={cn("truncate text-[15px] font-semibold tracking-tight", ok ? "text-pos" : pending ? "text-muted" : "text-neg")}>
          {value}
        </div>
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
    refetchInterval: 8_000,
  });

  const h = q.data;
  const stage = lastEvent?.type === "APPLICATION_STAGE_CHANGED" ? lastEvent.payload : null;
  const activeIdx = stage ? (STAGE_INDEX[stage.stage] ?? -1) : -1;
  const failed = stage?.stage === "FAILED";

  return (
    <PageIn className="mx-auto max-w-6xl">
      {/* hero band */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="display text-[40px] font-semibold leading-[1.05] tracking-[-0.03em]">Dashboard</h1>
          <p className="mt-2 text-[15px] text-muted">Every subsystem, at a glance.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border/70 bg-surface-2/50 px-3.5 py-1.5 text-xs text-muted">
          <span className="tnum font-medium text-text">sidecar {h?.version ?? "—"}</span>
          <span className="size-1 rounded-full bg-border" />
          <span>contract v{h?.contract_version ?? "1"}</span>
        </div>
      </div>

      {q.isError && (
        <Rise className="mt-8">
          <div className="rounded-2xl border border-neg/25 bg-neg/5 p-5 text-sm text-neg">
            Backend unreachable on 127.0.0.1:8000 — start the sidecar, or enable fixture mode.
          </div>
        </Rise>
      )}

      {q.isLoading && (
        <div className="mt-8 space-y-4">
          <div className="skeleton h-32" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24" />)}
          </div>
          <div className="skeleton h-48" />
        </div>
      )}

      {h && (
        <Stagger className="mt-8 space-y-4" gap={0.08}>
          {/* hero metric band */}
          <Rise>
            <GlassCard className="relative overflow-hidden p-7">
              <div
                className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full opacity-25"
                style={{ background: "radial-gradient(circle, var(--color-accent) 0%, transparent 65%)" }}
              />
              <div className="relative flex flex-wrap items-center justify-between gap-8">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Jobs discovered</div>
                  <div className="mt-2 flex items-baseline gap-3">
                    <CountUp value={8390} className="hero-num text-[64px] text-text" />
                    <span className="mb-2 inline-flex items-center gap-1 rounded-full border border-pos/30 bg-pos/10 px-2.5 py-1 text-[11px] font-medium text-pos">
                      <span className="size-1.5 rounded-full bg-pos animate-breathe" /> live
                    </span>
                  </div>
                  <div className="mt-1 text-[13px] text-muted">
                    from <span className="tnum text-text">50</span> companies · sweeps every{" "}
                    <span className="tnum text-text">5 min</span> · capped{" "}
                    <span className="tnum text-text">50/day</span>
                  </div>
                </div>
                <Link
                  href="/jobs/"
                  className="group flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-bg transition-transform active:scale-[0.98]"
                  style={{ boxShadow: "var(--shadow-glow)" }}
                >
                  Open inbox
                  <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </div>
            </GlassCard>
          </Rise>

          {/* status strip */}
          <Rise>
            <GlassCard hover={false} className="grid grid-cols-2 gap-6 p-6 lg:grid-cols-4">
              <StatusCell icon={Activity} label="Backend" value={h.status === "ok" ? "healthy" : h.status} ok={h.status === "ok"} />
              <StatusCell icon={Database} label="Database" value={h.db ? "SQLite · WAL" : "down"} ok={h.db} />
              <StatusCell icon={Bot} label="Automation browser" value={h.browser.running ? "running" : "not running"} ok={h.browser.running} pending={!h.browser.running} />
              <StatusCell icon={KeyRound} label="LLM" value={h.llm.degraded ? "degraded" : h.llm.configured ? "configured" : "no key"} ok={h.llm.configured && !h.llm.degraded} pending={!h.llm.configured} />
            </GlassCard>
          </Rise>

          {/* bento row */}
          <div className="grid gap-4 lg:grid-cols-5">
            <Rise className="lg:col-span-3">
              <GlassCard hover={false} className="h-full p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[13px] font-medium">
                    <span className={cn("size-1.5 rounded-full bg-accent", wsStatus === "open" && "animate-breathe")} />
                    Daily caps
                  </div>
                  <span className="text-[11px] text-muted">reset midnight</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col items-center gap-3">
                    <ProgressRing value={h.caps_today.linkedin.used} max={h.caps_today.linkedin.limit} size={92} label={`of ${h.caps_today.linkedin.limit}`} />
                    <span className="text-xs text-muted">LinkedIn</span>
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <ProgressRing value={h.caps_today.ats.used} max={h.caps_today.ats.limit} size={92} label={`of ${h.caps_today.ats.limit}`} />
                    <span className="text-xs text-muted">Direct ATS</span>
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <ProgressRing
                      value={h.caps_today.linkedin.used + h.caps_today.ats.used}
                      max={h.caps_today.linkedin.limit + h.caps_today.ats.limit}
                      size={92}
                      tone="var(--color-pos)"
                      label="global"
                    />
                    <span className="text-xs text-muted">Global</span>
                  </div>
                </div>
              </GlassCard>
            </Rise>

            <Rise className="lg:col-span-2">
              <GlassCard hover={false} className="h-full p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[13px] font-medium">
                    <Sparkles className="size-4 text-accent" /> Pipeline · 7 days
                  </div>
                  <span className="rounded border border-border px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted">demo</span>
                </div>
                <div className="space-y-4">
                  {[
                    { label: "Discovered", value: 312, w: 100 },
                    { label: "Scored ≥65", value: 96, w: 31 },
                    { label: "Tailored", value: 41, w: 13 },
                    { label: "Applied", value: 12, w: 4 },
                  ].map((s, i) => (
                    <div key={s.label}>
                      <div className="mb-1.5 flex justify-between text-[11px]">
                        <span className="text-muted">{s.label}</span>
                        <span className="tnum">{s.value}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-accent to-accent-strong"
                          initial={{ width: 0 }}
                          animate={{ width: `${s.w}%` }}
                          transition={{ ...SPRING, delay: 0.2 + i * 0.09, damping: 30 }}
                          style={{ boxShadow: "0 0 14px -3px #e08a5c99" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 border-t border-border/60 pt-3 text-[11px] text-muted">
                  reply tracking arrives with analytics (M6)
                </div>
              </GlassCard>
            </Rise>
          </div>

          {/* live run */}
          <Rise>
            <GlassCard hover={false} className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-[13px] font-medium">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-50" />
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
                  <div className="mt-5 flex items-center">
                    {STAGE_LABELS.map((s, i) => (
                      <div key={s} className="flex flex-1 items-center last:flex-none">
                        <div className="flex flex-col items-center gap-1.5">
                          <motion.div
                            initial={false}
                            animate={{
                              scale: i === activeIdx ? 1.2 : 1,
                              backgroundColor: failed && i >= 4 ? "var(--color-neg)" : i <= activeIdx ? "var(--color-accent)" : "var(--color-border)",
                            }}
                            className={cn("size-3 rounded-full", i === activeIdx && "shadow-glow")}
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
                <div className="py-1 text-sm text-muted">
                  No active run — the automation browser is idle. Approve a job to watch it fill live.
                </div>
              )}
            </GlassCard>
          </Rise>
        </Stagger>
      )}
    </PageIn>
  );
}
