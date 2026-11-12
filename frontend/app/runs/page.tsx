"use client";

/*
 * Run Monitor — real screen. No ?id= → recent runs list (GET /applications).
 * With ?id= → GET /applications/{id}: header, stage stepper from status,
 * vertical event timeline from the `events` array, status chip, screenshot
 * link, CAPTCHA 5:00 countdown note. Polls every 5s.
 */

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  AlertTriangle, ArrowLeft, Camera, ChevronRight, Clock3, Radar, Timer,
} from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/types";
import { ensureApi } from "@/lib/bootstrap";
import type { Paged } from "@/lib/api/types";
import { CompanyAvatar } from "@/components/company-avatar";
import { GlassCard, PageIn, Rise, Stagger } from "@/components/motion";
import { cn } from "@/lib/utils";

/* ---------- shapes (frozen contract §7.4) ---------- */

interface RunListItem {
  id: string;
  job_id: string;
  company: string;
  title: string;
  platform: string;
  submission_mode: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number;
  confirmation_receipt: string | null;
  screenshot_path: string | null;
  failure_stage: string | null;
  failure_reason: string | null;
}

interface QAAnswerAuditItem {
  id?: string | null;
  question_text: string;
  answer_value: string;
  resolution_tier: string; // DETERMINISTIC | LLM_GENERATED | USER_OVERRIDE | UNRESOLVED
  confidence_score: number;
  user_verified: boolean;
  timestamp: string | null;
}

interface AuditLogItem {
  id: string;
  entity_type: string;
  entity_id?: string | null;
  event_type: string;
  severity: string; // INFO | WARN | ERROR
  message: string;
  details: Record<string, unknown>;
  timestamp: string;
}

interface RunDetail extends RunListItem {
  qa_answers: QAAnswerAuditItem[];
  events: AuditLogItem[];
}

/* ---------- helpers ---------- */

const STAGE_LABELS = ["NAVIGATING", "FILLING", "UPLOADING", "ANSWERING", "REVIEW", "SUBMITTED"] as const;
const STAGE_INDEX: Record<string, number> = {
  NAVIGATING: 0,
  FILLING_FIELDS: 1,
  UPLOADING_RESUME: 2,
  ANSWERING_QA: 3,
  PAUSED_FOR_REVIEW: 4,
  SUBMITTED: 5,
  APPLIED: 5,
  FAILED: 5,
};

function fmtDuration(s: number): string {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${String(sec).padStart(2, "0")}s` : `${sec}s`;
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function fmtClock(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour12: false });
  } catch {
    return "—";
  }
}

function statusTone(status: string): string {
  switch (status) {
    case "SUBMITTED":
    case "APPLIED":
      return "border-pos/30 bg-pos/10 text-pos";
    case "PAUSED_FOR_REVIEW":
      return "border-accent/30 bg-accent/10 text-accent";
    case "CAPTCHA_BLOCKED":
    case "BLOCKED":
      return "border-warn/30 bg-warn/10 text-warn";
    case "FAILED":
      return "border-neg/30 bg-neg/10 text-neg";
    default:
      return "border-border bg-surface-2 text-muted";
  }
}

function statusDot(status: string): string {
  switch (status) {
    case "SUBMITTED":
    case "APPLIED":
      return "bg-pos";
    case "PAUSED_FOR_REVIEW":
      return "bg-accent";
    case "CAPTCHA_BLOCKED":
    case "BLOCKED":
      return "bg-warn";
    case "FAILED":
      return "bg-neg";
    default:
      return "bg-neutral-chip";
  }
}

const PROV_TONE: Record<string, string> = {
  DETERMINISTIC: "border-prov-deterministic/30 bg-prov-deterministic/10 text-prov-deterministic",
  LLM_GENERATED: "border-prov-llm/30 bg-prov-llm/10 text-prov-llm",
  USER_OVERRIDE: "border-pos/30 bg-pos/10 text-pos",
  UNRESOLVED: "border-prov-unresolved/30 bg-prov-unresolved/10 text-prov-unresolved",
};

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------- page shell: ?id= inside Suspense ---------- */

export default function RunsPage() {
  return (
    <Suspense
      fallback={
        <PageIn className="mx-auto max-w-5xl">
          <div className="skeleton h-10 w-56" />
          <div className="skeleton mt-7 h-40" />
        </PageIn>
      }
    >
      <RunsContent />
    </Suspense>
  );
}

function RunsContent() {
  const sp = useSearchParams();
  const id = sp.get("id");
  return id ? <RunDetailScreen id={id} /> : <RunListScreen />;
}

/* ---------- list mode: recent 10 runs ---------- */

function RunListScreen() {
  const q = useQuery<Paged<RunListItem>>({
    queryKey: ["applications", "recent"],
    queryFn: () => apiFetch<Paged<RunListItem>>("/applications?page=1&page_size=10"),
    refetchInterval: 5_000,
  });

  const runs = q.data?.items ?? [];

  return (
    <PageIn className="mx-auto max-w-4xl">
      <div>
        <h1 className="display text-[32px] font-semibold tracking-[-0.03em]">Run Monitor</h1>
        <p className="mt-1.5 text-sm text-muted">
          Every application run, stage by stage — open one to watch it work.
        </p>
      </div>

      {q.isError && (
        <Rise className="mt-7">
          <div className="rounded-xl border border-neg/25 bg-neg/5 p-4 text-sm text-neg">
            Runs endpoint unreachable — is the sidecar up?
          </div>
        </Rise>
      )}

      {q.isLoading && (
        <div className="mt-7 space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-14" />
          ))}
        </div>
      )}

      {q.data && runs.length === 0 && (
        <Rise className="mt-7">
          <GlassCard hover={false} className="flex flex-col items-center justify-center px-6 py-16">
            <div className="flex size-14 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10">
              <Radar className="size-6 text-accent" />
            </div>
            <div className="display mt-4 text-lg">No runs yet</div>
            <div className="mt-1.5 max-w-md text-center text-xs leading-relaxed text-muted">
              Approve a job from the pipeline and its run appears here — every stage, answer, and
              receipt recorded as it happens.
            </div>
          </GlassCard>
        </Rise>
      )}

      {runs.length > 0 && (
        <Stagger className="mt-7" gap={0.05}>
          <Rise>
            <GlassCard hover={false} className="divide-y divide-border/60 overflow-hidden">
              {runs.map((r) => (
                <Link
                  key={r.id}
                  href={`/runs?id=${r.id}`}
                  className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-2/60"
                >
                  <span className={cn("size-2 shrink-0 rounded-full", statusDot(r.status))} />
                  <CompanyAvatar name={r.company} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {r.company} <span className="text-muted">· {r.title}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted">
                      <span className="font-mono uppercase tracking-wider">{r.platform}</span>
                      <span className="tnum">{fmtDuration(r.duration_seconds)}</span>
                      <span>{fmtDateTime(r.started_at)}</span>
                    </div>
                  </div>
                  <Chip className={statusTone(r.status)}>{r.status.replace(/_/g, " ")}</Chip>
                  <ChevronRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                </Link>
              ))}
            </GlassCard>
          </Rise>
        </Stagger>
      )}
    </PageIn>
  );
}

/* ---------- detail mode: one run ---------- */

function RunDetailScreen({ id }: { id: string }) {
  const [apiBase, setApiBase] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    ensureApi()
      .then((b) => {
        if (alive) setApiBase(b.baseUrl);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const q = useQuery<RunDetail>({
    queryKey: ["application", id],
    queryFn: () => apiFetch<RunDetail>(`/applications/${id}`),
    refetchInterval: 5_000,
    retry: (count, err) => (err instanceof ApiError && err.status === 404 ? false : count < 2),
  });

  const d = q.data;

  return (
    <PageIn className="mx-auto max-w-4xl" key={id}>
      <Link
        href="/runs"
        className="inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-3.5" /> All runs
      </Link>

      {q.isError && (
        <Rise className="mt-6">
          <GlassCard hover={false} className="flex flex-col items-center justify-center px-6 py-16">
            <div className="flex size-14 items-center justify-center rounded-2xl border border-neg/30 bg-neg/10">
              <AlertTriangle className="size-6 text-neg" />
            </div>
            <div className="display mt-4 text-lg">Run not found</div>
            <div className="mt-1.5 max-w-md text-center text-xs leading-relaxed text-muted">
              This application id doesn&apos;t exist (or the sidecar is down). It may have been
              discarded before any stage ran.
            </div>
          </GlassCard>
        </Rise>
      )}

      {q.isLoading && (
        <div className="mt-6 space-y-4">
          <div className="skeleton h-36" />
          <div className="skeleton h-28" />
        </div>
      )}

      {d && (
        <Stagger className="mt-4 space-y-4" gap={0.07}>
          {/* header */}
          <Rise>
            <GlassCard hover={false} className="p-5">
              <div className="flex items-start gap-4">
                <CompanyAvatar name={d.company} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{d.company}</span>
                    <Chip className="border-border bg-surface-2 text-muted">
                      <span className="font-mono">{d.platform}</span>
                    </Chip>
                    <Chip className="border-border bg-surface-2 text-muted">
                      {d.submission_mode.replace(/_/g, " ")}
                    </Chip>
                    <Chip className={statusTone(d.status)}>{d.status.replace(/_/g, " ")}</Chip>
                  </div>
                  <div className="display mt-1 truncate text-xl font-semibold tracking-[-0.02em]">
                    {d.title}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
                    <span>started {fmtDateTime(d.started_at)}</span>
                    <span className="tnum inline-flex items-center gap-1.5">
                      <Clock3 className="size-3" /> {fmtDuration(d.duration_seconds)}
                    </span>
                    {d.confirmation_receipt && (
                      <span className="max-w-[280px] truncate font-mono" title={d.confirmation_receipt}>
                        receipt {d.confirmation_receipt}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <StageStepper status={d.status} />
            </GlassCard>
          </Rise>

          {d.status === "CAPTCHA_BLOCKED" && (
            <Rise>
              <div className="flex items-center gap-4 rounded-xl border border-warn/30 bg-warn/5 p-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-warn/30 bg-warn/10">
                  <Timer className="size-5 text-warn" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-warn">CAPTCHA — human needed</div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">
                    The run hit a challenge it won&apos;t solve silently. You have 5:00 to clear it
                    in the visible browser — after the window the run aborts (Amendment A4, made
                    visible).
                  </p>
                </div>
                <div className="hero-num tnum shrink-0 text-[40px] leading-none text-warn">5:00</div>
              </div>
            </Rise>
          )}

          {d.status === "FAILED" && (d.failure_stage || d.failure_reason) && (
            <Rise>
              <div className="rounded-xl border border-neg/25 bg-neg/5 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-neg">
                  <AlertTriangle className="size-4" />
                  Failed at {d.failure_stage?.replace(/_/g, " ") ?? "unknown stage"}
                </div>
                {d.failure_reason && (
                  <p className="mt-1 text-xs leading-relaxed text-muted">{d.failure_reason}</p>
                )}
              </div>
            </Rise>
          )}

          {/* events timeline + side column */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Rise className="lg:col-span-2">
              <GlassCard hover={false} className="h-full p-5">
                <div className="text-[13px] font-medium text-muted uppercase tracking-[0.14em]">
                  Event log
                </div>
                {d.events.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted">
                    No events recorded yet — the run may still be queueing.
                  </div>
                ) : (
                  <div className="mt-4 space-y-0">
                    {d.events.map((e, i) => (
                      <div key={e.id} className="relative flex gap-4 pb-5 last:pb-0">
                        {i < d.events.length - 1 && (
                          <div className="absolute left-[5px] top-4 h-full w-px bg-border" />
                        )}
                        <span
                          className={cn(
                            "relative mt-1.5 size-[11px] shrink-0 rounded-full",
                            e.severity === "ERROR"
                              ? "bg-neg"
                              : e.severity === "WARN"
                                ? "bg-warn"
                                : "bg-accent",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="tnum font-mono text-[10px] text-muted">
                              {fmtClock(e.timestamp)}
                            </span>
                            <span className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted">
                              {e.event_type}
                            </span>
                          </div>
                          <div className="mt-1 text-sm leading-snug">{e.message}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            </Rise>

            <Rise className="space-y-4">
              <GlassCard hover={false} className="p-5">
                <div className="text-[13px] font-medium text-muted uppercase tracking-[0.14em]">
                  Answers given
                </div>
                {d.qa_answers.length === 0 ? (
                  <div className="mt-3 text-xs leading-relaxed text-muted">
                    No form questions answered yet — they appear here with provenance as the run
                    fills fields.
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {d.qa_answers.map((a) => (
                      <div key={a.id ?? a.question_text} className="text-xs">
                        <div className="truncate font-medium" title={a.question_text}>
                          {a.question_text}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Chip className={PROV_TONE[a.resolution_tier] ?? "border-border bg-surface-2 text-muted"}>
                            {a.resolution_tier.replace(/_/g, " ")}
                          </Chip>
                          <span className="tnum text-muted">
                            {(a.confidence_score * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="mt-1 truncate text-muted" title={a.answer_value}>
                          {a.answer_value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>

              <GlassCard hover={false} className="p-5">
                <div className="text-[13px] font-medium text-muted uppercase tracking-[0.14em]">
                  Receipt
                </div>
                <div className="mt-3 space-y-3 text-xs text-muted">
                  <div>
                    <div className="font-medium text-text">Screenshot</div>
                    {d.screenshot_path ? (
                      <a
                        href={apiBase ? `${apiBase}${d.screenshot_path}` : undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
                      >
                        <Camera className="size-3.5" /> View proof of submission
                      </a>
                    ) : (
                      <div className="mt-1">Captured when the run completes.</div>
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-text">Confirmation</div>
                    <div className="mt-1 break-all font-mono text-[11px]">
                      {d.confirmation_receipt ?? "—"}
                    </div>
                  </div>
                </div>
              </GlassCard>
            </Rise>
          </div>
        </Stagger>
      )}
    </PageIn>
  );
}

/* ---------- stage stepper (built from status) ---------- */

function StageStepper({ status }: { status: string }) {
  const activeIdx = STAGE_INDEX[status] ?? -1;
  const failed = status === "FAILED";
  const discarded = status === "DISCARDED" || status === "ABORTED";
  const blocked = status === "CAPTCHA_BLOCKED" || status === "BLOCKED";

  const nodeTone = (i: number): string => {
    if (discarded) return i === 0 ? "bg-neutral-chip" : "bg-border";
    if (failed && i >= activeIdx) return "bg-neg";
    if (blocked && i === activeIdx) return "bg-warn";
    if (i <= activeIdx) return "bg-accent";
    return "bg-border";
  };

  return (
    <div className="mt-5 border-t border-border/60 pt-4">
      <div className="flex items-center">
        {STAGE_LABELS.map((s, i) => (
          <div key={s} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "size-2.5 rounded-full transition-colors",
                  nodeTone(i),
                  i === activeIdx && !failed && !discarded && "shadow-glow",
                  failed && i >= activeIdx && "shadow-[0_0_14px_-3px_rgba(248,113,113,0.6)]",
                )}
              />
              <span
                className={cn(
                  "text-[9px] tracking-wide",
                  failed && i >= activeIdx
                    ? "text-neg"
                    : blocked && i === activeIdx
                      ? "text-warn"
                      : i <= activeIdx && !discarded
                        ? "text-text"
                        : "text-muted",
                )}
              >
                {s}
              </span>
            </div>
            {i < STAGE_LABELS.length - 1 && (
              <div
                className={cn(
                  "mx-1 h-px flex-1",
                  i < activeIdx && !discarded && !failed ? "bg-accent/50" : "bg-border",
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
