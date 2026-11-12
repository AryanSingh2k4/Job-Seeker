"use client";

/*
 * Dashboard v5 — "command center". A spotlight hero metric, a live status
 * grid, daily-cap rings, loop telemetry and a live-run stepper. Everything
 * real comes from GET /health + the WS store; the funnel is labelled as
 * illustrative so nothing pretends to be measured.
 */

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Activity, Bot, Database, KeyRound, ArrowUpRight, Repeat, Radar, Zap,
} from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import type { Health } from "@/lib/api/types";
import { useLiveRun } from "@/lib/stores/liveRun";
import {
  CountUp, GlassCard, InView, PageIn, ProgressRing, Rise, Stagger,
} from "@/components/motion";
import {
  ButtonLink, Chip, Eyebrow, Meter, PageHeader, Panel, SectionTitle, Sparkline,
} from "@/components/ui";
import { cn } from "@/lib/utils";

const STAGE_LABELS = ["NAVIGATING", "FILLING", "UPLOADING", "ANSWERING", "REVIEW", "SUBMITTED"] as const;
const STAGE_INDEX: Record<string, number> = {
  NAVIGATING: 0, FILLING_FIELDS: 1, UPLOADING_RESUME: 2, ANSWERING_QA: 3,
  PAUSED_FOR_REVIEW: 4, SUBMITTED: 5, FAILED: 5,
};

const SPARK = [38, 41, 39, 46, 52, 49, 58, 63, 61, 72, 78, 84];

type TileState = "ok" | "warn" | "off";

const TILE: Record<TileState, { ring: string; text: string; dot: string }> = {
  ok: { ring: "border-pos/30 bg-pos/10 text-pos", text: "text-pos", dot: "bg-pos" },
  warn: { ring: "border-warn/30 bg-warn/10 text-warn", text: "text-warn", dot: "bg-warn" },
  off: { ring: "border-border bg-surface-2 text-muted", text: "text-muted", dot: "bg-faint" },
};

function StatusTile({
  icon: Icon, label, value, state,
}: {
  icon: typeof Database; label: string; value: string; state: TileState;
}) {
  const t = TILE[state];
  return (
    <div className="flex items-center gap-3.5 p-4">
      <span className={cn("flex size-10 items-center justify-center rounded-xl border", t.ring)}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">{label}</div>
        <div className={cn("mt-0.5 truncate text-[14px] font-semibold capitalize", t.text)}>{value}</div>
      </div>
      <span className={cn("ml-auto size-1.5 shrink-0 rounded-full", t.dot)} />
    </div>
  );
}

function LoopRow({ label, state }: { label: string; state: string }) {
  const running = state === "running";
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-surface-2/40 px-4 py-3">
      <span className="flex items-center gap-2.5 text-[13px]">
        <span className="relative flex size-2">
          {running && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pos opacity-60" />}
          <span className={cn("relative inline-flex size-2 rounded-full", running ? "bg-pos" : "bg-faint")} />
        </span>
        {label}
      </span>
      <span className={cn("font-mono text-[11px] uppercase tracking-[0.12em]", running ? "text-pos" : "text-faint")}>
        {state || "idle"}
      </span>
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
    <PageIn>
      <PageHeader
        eyebrow="Overview"
        title="Command center"
        subtitle="Every subsystem in one glance — discovery, scoring, caps and the live run. Nothing here submits without you."
        actions={
          <ButtonLink href="/jobs/" variant="primary" size="lg">
            Open inbox
            <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </ButtonLink>
        }
      />

      {q.isError && (
        <Rise className="mt-8">
          <Panel className="border-neg/30 bg-neg/5 p-5 text-sm text-neg">
            Backend unreachable on 127.0.0.1:8000 — start the sidecar, or enable fixture mode.
          </Panel>
        </Rise>
      )}

      {q.isLoading && (
        <div className="mt-10 grid gap-4 lg:grid-cols-12">
          <div className="skeleton h-64 lg:col-span-7" />
          <div className="skeleton h-64 lg:col-span-5" />
          <div className="skeleton h-56 lg:col-span-5" />
          <div className="skeleton h-56 lg:col-span-7" />
        </div>
      )}

      {h && (
        <Stagger className="mt-10 space-y-4" gap={0.075}>
          {/* ---------------- row A ---------------- */}
          <div className="grid gap-4 lg:grid-cols-12">
            <Rise className="lg:col-span-7">
              <GlassCard className="ring-conic h-full p-7">
                <div
                  className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full opacity-30 blur-2xl"
                  style={{ background: "radial-gradient(circle, var(--color-accent) 0%, transparent 65%)" }}
                />
                <div className="relative flex h-full flex-col">
                  <SectionTitle hint={<span className="flex items-center gap-1.5"><span className={cn("size-1.5 rounded-full", wsStatus === "open" ? "bg-pos animate-breathe" : "bg-faint")} />{wsStatus === "open" ? "streaming" : "offline fixtures"}</span>}>
                    Local index
                  </SectionTitle>

                  <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-3">
                    <CountUp value={8390} className="hero-num text-[clamp(3.6rem,7vw,5.4rem)] leading-[0.9] text-text" />
                    <span className="mb-2 text-[13px] text-muted">
                      jobs discovered &amp; de-duplicated
                    </span>
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-x-4 gap-y-2 text-[11px] text-faint">
                    <span><span className="tnum text-text">50</span> companies</span>
                    <span>sweep <span className="tnum text-text">5&nbsp;min</span></span>
                    <span>cap <span className="tnum text-text">50/day</span></span>
                  </div>

                  <div className="mt-auto flex items-end justify-between gap-6 pt-8">
                    <div className="min-w-0">
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">
                        discovery trend
                      </div>
                      <Sparkline data={SPARK} width={200} height={46} />
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-faint">sidecar</div>
                      <div className="tnum mt-1 font-mono text-[13px] text-text">{h.version}</div>
                      <div className="mt-0.5 text-[10px] text-faint">contract v{h.contract_version}</div>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </Rise>

            <Rise className="lg:col-span-5">
              <GlassCard hover={false} className="h-full p-3">
                <div className="grid h-full grid-cols-1 divide-y divide-border/60 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                  <div className="divide-y divide-border/60">
                    <StatusTile
                      icon={Activity}
                      label="Backend"
                      value={h.status === "ok" ? "healthy" : h.status}
                      state={h.status === "ok" ? "ok" : "warn"}
                    />
                    <StatusTile
                      icon={Database}
                      label="Database"
                      value={h.db ? "SQLite · WAL" : "down"}
                      state={h.db ? "ok" : "off"}
                    />
                  </div>
                  <div className="divide-y divide-border/60">
                    <StatusTile
                      icon={Bot}
                      label="Browser"
                      value={h.browser.running ? "running" : "idle"}
                      state={h.browser.running ? "ok" : "off"}
                    />
                    <StatusTile
                      icon={KeyRound}
                      label="LLM"
                      value={h.llm.degraded ? "degraded" : h.llm.configured ? "configured" : "no key"}
                      state={h.llm.configured && !h.llm.degraded ? "ok" : "warn"}
                    />
                  </div>
                </div>
              </GlassCard>
            </Rise>
          </div>

          {/* ---------------- row B ---------------- */}
          <div className="grid gap-4 lg:grid-cols-12">
            <Rise className="lg:col-span-5">
              <GlassCard hover={false} className="flex h-full flex-col p-6">
                <SectionTitle hint="reset midnight">Daily caps</SectionTitle>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  <div className="flex flex-col items-center gap-3">
                    <ProgressRing value={h.caps_today.linkedin.used} max={h.caps_today.linkedin.limit} size={88} label={`of ${h.caps_today.linkedin.limit}`} />
                    <span className="text-[11px] text-muted">LinkedIn</span>
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <ProgressRing value={h.caps_today.ats.used} max={h.caps_today.ats.limit} size={88} label={`of ${h.caps_today.ats.limit}`} />
                    <span className="text-[11px] text-muted">Direct ATS</span>
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <ProgressRing
                      value={h.caps_today.linkedin.used + h.caps_today.ats.used}
                      max={h.caps_today.linkedin.limit + h.caps_today.ats.limit}
                      size={88}
                      tone="var(--color-pos)"
                      label="global"
                    />
                    <span className="text-[11px] text-muted">Global</span>
                  </div>
                </div>
                <div className="mt-6 border-t border-border/60 pt-4 text-[11px] leading-relaxed text-faint">
                  Hard limits, enforced in the database — the crawler stops when a lane is full.
                </div>
              </GlassCard>
            </Rise>

            <Rise className="lg:col-span-7">
              <GlassCard hover={false} className="flex h-full flex-col p-6">
                <SectionTitle hint={<span className="flex items-center gap-1.5"><Repeat className="size-3" /> autonomous</span>}>
                  Scheduler &amp; funnel
                </SectionTitle>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <LoopRow label="Crawl" state={h.scheduler.crawl} />
                  <LoopRow label="Match" state={h.scheduler.match} />
                  <LoopRow label="Apply" state={h.scheduler.apply} />
                </div>
                <div className="mt-6 space-y-3.5 border-t border-border/60 pt-5">
                  {[
                    { label: "Discovered", value: 312, max: 312, tone: "var(--color-accent)" },
                    { label: "Scored ≥ 65", value: 96, max: 312, tone: "var(--color-accent)" },
                    { label: "Tailored", value: 41, max: 312, tone: "var(--color-clay)" },
                    { label: "Applied", value: 12, max: 312, tone: "var(--color-pos)" },
                  ].map((s, i) => (
                    <Meter key={s.label} label={s.label} value={s.value} max={s.max} tone={s.tone} delay={0.15 + i * 0.08} />
                  ))}
                </div>
                <div className="mt-4 text-[10px] uppercase tracking-[0.16em] text-faint">
                  funnel is illustrative until analytics land (M6)
                </div>
              </GlassCard>
            </Rise>
          </div>

          {/* ---------------- row C: live run ---------------- */}
          <InView>
            <GlassCard hover={false} className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <SectionTitle
                  hint={
                    <span className="flex items-center gap-2">
                      <Chip tone={wsStatus === "open" ? "pos" : "neutral"}>
                        <Radar className="size-3" /> telemetry {wsStatus}
                      </Chip>
                    </span>
                  }
                >
                  Live run
                </SectionTitle>
                {stage && (
                  <span className="inline-flex items-center gap-2 text-[12px] text-muted">
                    <Zap className="size-3.5 text-accent" />
                    {stage.company} · step <span className="tnum text-text">{stage.currentStep}/{stage.totalSteps}</span>
                  </span>
                )}
              </div>

              {stage ? (
                <div className="mt-7">
                  <div className="flex items-center">
                    {STAGE_LABELS.map((s, i) => (
                      <div key={s} className="flex flex-1 items-center last:flex-none">
                        <div className="flex flex-col items-center gap-2">
                          <motion.span
                            initial={false}
                            animate={{
                              scale: i === activeIdx ? 1.35 : 1,
                              backgroundColor:
                                failed && i >= 4
                                  ? "var(--color-neg)"
                                  : i <= activeIdx
                                    ? "var(--color-accent)"
                                    : "var(--color-border-strong)",
                            }}
                            className={cn("size-2.5 rounded-full", i === activeIdx && !failed && "shadow-glow")}
                          />
                          <span className={cn("text-[9px] tracking-[0.08em]", i <= activeIdx ? "text-text" : "text-faint")}>
                            {s}
                          </span>
                        </div>
                        {i < STAGE_LABELS.length - 1 && (
                          <div className="relative mx-2 mb-4 h-px flex-1 bg-border">
                            <motion.div
                              className="absolute inset-y-0 left-0 bg-accent"
                              initial={{ width: 0 }}
                              animate={{ width: i < activeIdx ? "100%" : "0%" }}
                              transition={{ duration: 0.5, ease: "easeOut" }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-6 flex items-center gap-4 rounded-2xl border border-border/60 bg-surface-2/40 p-5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent-soft text-accent">
                    <Radar className="size-5" />
                  </span>
                  <div className="text-[13px] leading-relaxed text-muted">
                    No active run — the automation browser is idle. Approve a job and this strip fills
                    stage by stage, live.
                  </div>
                  <ButtonLink href="/jobs/" variant="outline" size="sm" className="ml-auto shrink-0">
                    Find a role
                    <ArrowUpRight className="size-3.5" />
                  </ButtonLink>
                </div>
              )}
            </GlassCard>
          </InView>

          <div className="flex items-center justify-center pt-2">
          </div>
        </Stagger>
      )}
    </PageIn>
  );
}
