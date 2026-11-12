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
import { PageIn, Rise, Stagger } from "@/components/motion";
import { Chip, EmptyState, PageHeader, Panel, SectionTitle } from "@/components/ui";
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
  resolution_tier: string;
  confidence_score: number;
  user_verified: boolean;
  timestamp: string | null;
}

interface AuditLogItem {
  id: string;
  entity_type: string;
  entity_id?: string | null;
  event_type: string;
  severity: string;
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

type Tone = "neutral" | "accent" | "pos" | "warn" | "neg";

function statusTone(status: string): Tone {
  switch (status) {
    case "SUBMITTED":
    case "APPLIED":
      return "pos";
    case "PAUSED_FOR_REVIEW":
      return "accent";
    case "CAPTCHA_BLOCKED":
    case "BLOCKED":
      return "warn";
    case "FAILED":
      return "neg";
    default:
      return "neutral";
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

const PROV_TONE: Record<string, Tone> = {
  DETERMINISTIC: "neutral",
  LLM_GENERATED: "warn",
  USER_OVERRIDE: "pos",
  UNRESOLVED: "neg",
};

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
      <PageHeader
        eyebrow="Automation"
        title="Run monitor"
        subtitle="Every application run, stage by stage. Open one to watch it work and read the receipts."
      />

      {q.isError && (
        <Rise className="mt-10">
          <Panel className="border-neg/30 bg-neg/5 p-5 text-sm text-neg">
            Runs endpoint unreachable — is the sidecar up?
          </Panel>
        </Rise>
      )}

      {q.isLoading && (
        <div className="mt-10 space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-16" />
          ))}
        </div>
      )}

      {q.data && runs.length === 0 && (
        <Rise className="mt-10">
          <EmptyState
            icon={<Radar className="size-5" />}
            title="No runs yet"
            body="Approve a job from the inbox and its run appears here — every stage, answer and receipt recorded as it happens."
          />
        </Rise>
      )}

      {runs.length > 0 && (
        <Rise className="mt-10">
          <Panel className="divide-y divide-border/60 overflow-hidden">
            {runs.map((r) => (
              <Link
                key={r.id}
                href={`/runs?id=${r.id}`}
                className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2/60"
              >
                <span className={cn("size-2 shrink-0 rounded-full", statusDot(r.status))} />
                <CompanyAvatar name={r.company} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {r.company} <span className="font-normal text-muted">· {r.title}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-faint">
                    <span className="font-mono uppercase tracking-[0.1em]">{r.platform}</span>
                    <span className="tnum">{fmtDuration(r.duration_seconds)}</span>
                    <span>{fmtDateTime(r.started_at)}</span>
                  </div>
                </div>
                <Chip tone={statusTone(r.status)}>{r.status.replace(/_/g, " ")}</Chip>
                <ChevronRight className="size-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
              </Link>
            ))}
          </Panel>
        </Rise>
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
        className="link-quiet mb-5 inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-3.5" /> All runs
      </Link>

      {q.isError && (
        <Rise className="mt-4">
          <EmptyState
            icon={<AlertTriangle className="size-5" />}
            title="Run not found"
            body="This application id doesn't exist (or the sidecar is down). It may have been discarded before any stage ran."
          />
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
            <Panel className="p-5">
              <div className="flex items-start gap-4">
                <CompanyAvatar name={d.company} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{d.company}</span>
                    <Chip className="font-mono">{d.platform}</Chip>
                    <Chip>{d.submission_mode.replace(/_/g, " ")}</Chip>
                    <Chip tone={statusTone(d.status)}>{d.status.replace(/_/g, " ")}</Chip>
                  </div>
                  <div className="display mt-1.5 truncate text-[clamp(1.3rem,2.4vw,1.7rem)] leading-tight text-text">
                    {d.title}
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-faint">
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
            </Panel>
          </Rise>

          {d.status === "CAPTCHA_BLOCKED" && (
            <Rise>
              <div className="flex items-center gap-4 rounded-2xl border border-warn/30 bg-warn/5 p-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-warn/30 bg-warn/10 text-warn">
                  <Timer className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-warn">CAPTCHA — human needed</div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">
                    The run hit a challenge it won&apos;t solve silently. You have 5:00 to clear it in
                    the visible browser — after that the run aborts.
                  </p>
                </div>
                <div className="hero-num tnum shrink-0 text-[40px] leading-none text-warn">5:00</div>
              </div>
            </Rise>
          )}

          {d.status === "FAILED" && (d.failure_stage || d.failure_reason) && (
            <Rise>
              <div className="rounded-2xl border border-neg/30 bg-neg/5 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-neg">
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
              <Panel className="h-full p-5">
                <SectionTitle>Event log</SectionTitle>
                {d.events.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted">
                    No events recorded yet — the run may still be queueing.
                  </div>
                ) : (
                  <div className="mt-5">
                    {d.events.map((e, i) => (
                      <div key={e.id} className="relative flex gap-4 pb-5 last:pb-0">
                        {i < d.events.length - 1 && (
                          <div className="absolute left-[5px] top-4 h-full w-px bg-border" />
                        )}
                        <span
                          className={cn(
                            "relative mt-1.5 size-[11px] shrink-0 rounded-full",
                            e.severity === "ERROR" ? "bg-neg" : e.severity === "WARN" ? "bg-warn" : "bg-accent",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="tnum font-mono text-[10px] text-faint">
                              {fmtClock(e.timestamp)}
                            </span>
                            <span className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-faint">
                              {e.event_type}
                            </span>
                          </div>
                          <div className="mt-1 text-sm leading-snug">{e.message}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </Rise>

            <Rise className="space-y-4">
              <Panel className="p-5">
                <SectionTitle>Answers given</SectionTitle>
                {d.qa_answers.length === 0 ? (
                  <div className="mt-3.5 text-xs leading-relaxed text-muted">
                    No form questions answered yet — they appear here with provenance as the run fills
                    fields.
                  </div>
                ) : (
                  <div className="mt-3.5 space-y-4">
                    {d.qa_answers.map((a) => (
                      <div key={a.id ?? a.question_text} className="text-xs">
                        <div className="truncate font-medium" title={a.question_text}>
                          {a.question_text}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Chip tone={PROV_TONE[a.resolution_tier] ?? "neutral"}>
                            {a.resolution_tier.replace(/_/g, " ")}
                          </Chip>
                          <span className="tnum text-faint">{(a.confidence_score * 100).toFixed(0)}%</span>
                        </div>
                        <div className="mt-1 truncate text-muted" title={a.answer_value}>
                          {a.answer_value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel className="p-5">
                <SectionTitle>Receipt</SectionTitle>
                <div className="mt-3.5 space-y-4 text-xs text-muted">
                  <div>
                    <div className="font-medium text-text">Screenshot</div>
                    {d.screenshot_path ? (
                      <a
                        href={apiBase ? `${apiBase}${d.screenshot_path}` : undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-accent/35 bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/20"
                      >
                        <Camera className="size-3.5" /> View proof of submission
                      </a>
                    ) : (
                      <div className="mt-1">Captured when the run completes.</div>
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-text">Confirmation</div>
                    <div className="mt-1 break-all font-mono text-[11px]">{d.confirmation_receipt ?? "—"}</div>
                  </div>
                </div>
              </Panel>
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
    <div className="mt-6 border-t border-border/60 pt-5">
      <div className="flex items-center">
        {STAGE_LABELS.map((s, i) => (
          <div key={s} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <span
                className={cn(
                  "size-2.5 rounded-full transition-colors",
                  nodeTone(i),
                  i === activeIdx && !failed && !discarded && "shadow-glow",
                  failed && i >= activeIdx && "shadow-[0_0_14px_-3px_var(--color-neg)]",
                )}
              />
              <span
                className={cn(
                  "text-[9px] tracking-[0.06em]",
                  failed && i >= activeIdx
                    ? "text-neg"
                    : blocked && i === activeIdx
                      ? "text-warn"
                      : i <= activeIdx && !discarded
                        ? "text-text"
                        : "text-faint",
                )}
              >
                {s}
              </span>
            </div>
            {i < STAGE_LABELS.length - 1 && (
              <div
                className={cn(
                  "mx-2 mb-4 h-px flex-1",
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
