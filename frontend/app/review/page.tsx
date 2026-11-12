"use client";

/*
 * Review Queue — real screen: every run the applier paused for a human
 * decision. GET /applications?status=PAUSED_FOR_REVIEW (5s polling),
 * Discard → POST /applications/abort/{id}, Open run → /runs?id=<id>.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock3, ShieldCheck, ShieldX } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api/client";
import type { Paged } from "@/lib/api/types";
import { CompanyAvatar } from "@/components/company-avatar";
import { CountUp, GlassCard, PageIn, Rise, Stagger } from "@/components/motion";
import { cn } from "@/lib/utils";

interface PausedRun {
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

function fmtDuration(s: number): string {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${String(sec).padStart(2, "0")}s` : `${sec}s`;
}

function fmtStarted(iso: string): string {
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

export default function ReviewPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const q = useQuery<Paged<PausedRun>>({
    queryKey: ["applications", "paused"],
    queryFn: () => apiFetch<Paged<PausedRun>>("/applications?status=PAUSED_FOR_REVIEW&page=1&page_size=50"),
    refetchInterval: 5_000,
  });

  const discard = useMutation({
    mutationFn: (id: string) => apiFetch<{ status: string }>(`/applications/abort/${id}`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Run discarded — nothing was submitted");
      void qc.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: () => toast.error("Discard failed — sidecar unreachable"),
  });

  const runs = q.data?.items ?? [];
  const pending = q.data?.total ?? runs.length;

  return (
    <PageIn className="mx-auto max-w-3xl">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="display text-[32px] font-semibold tracking-[-0.03em]">Review Queue</h1>
          <p className="mt-1.5 text-sm text-muted">
            Human-in-the-loop approvals — nothing submits without you.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="hero-num tnum text-[56px] leading-none text-accent">
            {q.isLoading ? <span className="text-muted">—</span> : <CountUp value={pending} />}
          </div>
          <div className="mt-1 text-[13px] font-medium text-muted uppercase tracking-[0.14em]">
            waiting
          </div>
        </div>
      </div>

      {q.isError && (
        <Rise className="mt-7">
          <div className="rounded-xl border border-neg/25 bg-neg/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-neg">
              <ShieldX className="size-4" /> Review queue unreachable
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              The applier service lands at M4 — until then this endpoint may not answer. Retry
              automatically every 5s.
            </p>
          </div>
        </Rise>
      )}

      {q.isLoading && (
        <div className="mt-7 space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="skeleton h-[132px]" />
          ))}
        </div>
      )}

      {q.data && runs.length === 0 && (
        <Rise className="mt-7">
          <GlassCard hover={false} className="flex flex-col items-center justify-center px-6 py-16">
            <div className="flex size-14 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10">
              <ShieldCheck className="size-6 text-accent" />
            </div>
            <div className="display mt-4 text-lg">Nothing waiting — the queue is clean</div>
            <div className="mt-1.5 max-w-md text-center text-xs leading-relaxed text-muted">
              When the applier pauses mid-run for your sign-off, the card appears here with every
              answer and its provenance. Until then, nothing needs you.
            </div>
          </GlassCard>
        </Rise>
      )}

      {runs.length > 0 && (
        <Stagger className="mt-7 space-y-3" gap={0.07}>
          {runs.map((r) => (
            <Rise key={r.id}>
              <GlassCard className="p-5">
                <div className="flex items-start gap-4">
                  <CompanyAvatar name={r.company} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{r.company}</span>
                      <span className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
                        {r.platform}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-sm text-muted">{r.title}</div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5",
                          "border-accent/30 bg-accent/10 text-accent",
                        )}
                      >
                        <span className="relative flex size-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                          <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
                        </span>
                        WAITING
                      </span>
                      <span className="tnum inline-flex items-center gap-1.5">
                        <Clock3 className="size-3" /> {fmtDuration(r.duration_seconds)}
                      </span>
                      <span>started {fmtStarted(r.started_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2 border-t border-border/60 pt-4">
                  <button
                    onClick={() => discard.mutate(r.id)}
                    disabled={discard.isPending && discard.variables === r.id}
                    className="rounded-lg border border-neg/25 px-3 py-2 text-xs font-medium text-neg transition-colors hover:bg-neg/10 disabled:opacity-50"
                  >
                    {discard.isPending && discard.variables === r.id ? "Discarding…" : "Discard"}
                  </button>
                  <button
                    onClick={() => router.push(`/runs?id=${r.id}`)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-bg transition-colors hover:bg-accent-hover shadow-glow"
                  >
                    Open run <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </GlassCard>
            </Rise>
          ))}
        </Stagger>
      )}
    </PageIn>
  );
}
