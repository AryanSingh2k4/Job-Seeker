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
import { CountUp, PageIn, Rise, Stagger } from "@/components/motion";
import { Button, Chip, EmptyState, PageHeader, Panel } from "@/components/ui";
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
    <PageIn className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Human in the loop"
        title="Review queue"
        subtitle="Nothing submits without you. Runs that paused mid-form wait here — every answer and its provenance attached."
        actions={
          <div className="text-right">
            <div className="hero-num text-[clamp(2.6rem,5vw,3.6rem)] leading-none text-accent">
              {q.isLoading ? <span className="text-muted">—</span> : <CountUp value={pending} />}
            </div>
            <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
              waiting
            </div>
          </div>
        }
      />

      {q.isError && (
        <Rise className="mt-10">
          <Panel className="border-neg/30 bg-neg/5 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-neg">
              <ShieldX className="size-4" /> Review queue unreachable
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              The applier service lands at M4 — until then this endpoint may not answer. Retrying
              automatically every 5s.
            </p>
          </Panel>
        </Rise>
      )}

      {q.isLoading && (
        <div className="mt-10 space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="skeleton h-[136px]" />
          ))}
        </div>
      )}

      {q.data && runs.length === 0 && (
        <Rise className="mt-10">
          <EmptyState
            icon={<ShieldCheck className="size-5" />}
            title="Nothing waiting — the queue is clean"
            body="When the applier pauses mid-run for your sign-off, the card appears here with every answer and its provenance."
          />
        </Rise>
      )}

      {runs.length > 0 && (
        <Stagger className="mt-10 space-y-3" gap={0.07}>
          {runs.map((r) => (
            <Rise key={r.id}>
              <Panel spot hover className="p-5">
                <div className="flex items-start gap-4">
                  <CompanyAvatar name={r.company} size={46} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{r.company}</span>
                      <Chip className="font-mono">{r.platform}</Chip>
                    </div>
                    <div className="mt-0.5 truncate text-sm text-muted">{r.title}</div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted">
                      <Chip tone="accent">
                        <span className="relative flex size-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                          <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
                        </span>
                        waiting
                      </Chip>
                      <span className="tnum inline-flex items-center gap-1.5">
                        <Clock3 className="size-3" /> {fmtDuration(r.duration_seconds)}
                      </span>
                      <span>started {fmtStarted(r.started_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2 border-t border-border/60 pt-4">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => discard.mutate(r.id)}
                    disabled={discard.isPending && discard.variables === r.id}
                  >
                    {discard.isPending && discard.variables === r.id ? "Discarding…" : "Discard"}
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => router.push(`/runs?id=${r.id}`)}>
                    Open run <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </Panel>
            </Rise>
          ))}
        </Stagger>
      )}
    </PageIn>
  );
}
