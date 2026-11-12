"use client";

/*
 * Job Inbox — discovery surface (§7.2 JobListItem). One glass table, hairline
 * rows, j/k spotlight. Score bands and "fresh < 24h" filter client-side over
 * the fetched items; load-more appends pages from GET /jobs?page=N.
 */

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { AlertTriangle, ChevronDown, Inbox, Loader2, MapPin, RefreshCw } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import type { JobListItem, Paged } from "@/lib/api/types";
import { CountUp, GlassCard, PageIn, Rise, Stagger, SPRING } from "@/components/motion";
import { ScoreChip } from "@/components/score-chip";
import { CompanyAvatar } from "@/components/company-avatar";
import { JobDetailPanel } from "@/components/job-detail";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

type BandId = "all" | "ge80" | "mid" | "new";

/* Client-side filters over the fetched items — "New" = discovered < 24h. */
const BANDS: { id: BandId; label: string; test: (j: JobListItem) => boolean }[] = [
  { id: "all", label: "All", test: () => true },
  { id: "ge80", label: "≥80", test: (j) => j.match_score != null && j.match_score >= 80 },
  {
    id: "mid",
    label: "65–79",
    test: (j) => j.match_score != null && j.match_score >= 65 && j.match_score < 80,
  },
  { id: "new", label: "New", test: (j) => Date.now() - new Date(j.date_discovered).getTime() < DAY_MS },
];

/* Shared row geometry: avatar | role | source | salary | score | found. */
const ROW_GRID =
  "grid grid-cols-[36px_minmax(0,1fr)_88px_104px_72px_56px] items-center gap-x-4";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function TableHead() {
  return (
    <div
      className={cn(
        ROW_GRID,
        "border-b border-border/60 px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted",
      )}
    >
      <span />
      <span>Role</span>
      <span>Source</span>
      <span className="text-right">Salary</span>
      <span className="text-right">Score</span>
      <span className="text-right">Found</span>
    </div>
  );
}

function SalaryText({ job }: { job: JobListItem }) {
  const s = job.salary;
  if (!s?.min_amount) return <span className="text-xs text-muted/50">—</span>;
  const k = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`);
  const lo = s.interval === "hourly" ? `$${Math.round(s.min_amount)}` : k(s.min_amount);
  const hi =
    s.max_amount != null && s.max_amount !== s.min_amount
      ? s.interval === "hourly"
        ? `$${Math.round(s.max_amount)}`
        : k(s.max_amount)
      : null;
  const suffix = s.interval === "hourly" ? "/hr" : s.interval === "monthly" ? "/mo" : "";
  return (
    <span className="tnum font-mono text-xs text-muted">
      {hi ? `${lo}–${hi}` : lo}
      {suffix}
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  return (
    <span className="w-fit rounded-md border border-border/60 bg-surface-2/50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-muted">
      {source}
    </span>
  );
}

function Segmented({
  band,
  counts,
  onChange,
}: {
  band: BandId;
  counts: Record<BandId, number>;
  onChange: (b: BandId) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-border/60 bg-surface-2/50 p-1">
      {BANDS.map((b) => {
        const active = band === b.id;
        return (
          <button
            key={b.id}
            onClick={() => onChange(b.id)}
            className="relative rounded-full px-3 py-1.5 text-xs font-medium"
          >
            {active && (
              <motion.span
                layoutId="jobs-band-pill"
                className="absolute inset-0 rounded-full border border-accent/30 bg-accent-soft"
                transition={SPRING}
              />
            )}
            <span
              className={cn(
                "relative flex items-center gap-1.5 transition-colors",
                active ? "text-accent" : "text-muted hover:text-text",
              )}
            >
              {b.label}
              <span
                className={cn(
                  "tnum font-mono text-[10px]",
                  active ? "text-accent/70" : "text-muted/60",
                )}
              >
                {counts[b.id]}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function JobRow({
  job,
  active,
  onOpen,
}: {
  job: JobListItem;
  active: boolean;
  onOpen: () => void;
}) {
  const fresh = Date.now() - new Date(job.date_discovered).getTime() < DAY_MS;
  return (
    <button
      onClick={onOpen}
      className={cn(
        ROW_GRID,
        "group relative w-full px-5 py-3 text-left transition-[background-color,box-shadow] duration-200 hover:bg-surface-2/60",
        active && "bg-surface-2/40 shadow-glow",
      )}
    >
      <CompanyAvatar name={job.company} size={36} />
      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium text-text">{job.title}</div>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
          <span className="truncate">{job.company}</span>
          <span className="shrink-0 text-muted/50">·</span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{job.location}</span>
          </span>
          {job.workplace_type !== "unknown" && (
            <>
              <span className="shrink-0 text-muted/50">·</span>
              <span className="shrink-0 capitalize">{job.workplace_type}</span>
            </>
          )}
        </div>
      </div>
      <SourceBadge source={job.source} />
      <div className="justify-self-end text-right">
        <SalaryText job={job} />
      </div>
      <div className="max-w-full justify-self-end overflow-hidden">
        <ScoreChip score={job.match_score} status={job.status} />
      </div>
      <div className="flex items-center justify-end gap-1.5">
        {fresh && (
          <span
            title="discovered < 24h ago"
            className="size-1.5 shrink-0 rounded-full bg-accent shadow-glow"
          />
        )}
        <span className="tnum text-[11px] text-muted">{fmtDate(job.date_discovered)}</span>
      </div>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 border transition-colors duration-200",
          active ? "border-accent/40" : "border-transparent group-hover:border-accent/30",
        )}
      />
    </button>
  );
}

function SkeletonRow() {
  return (
    <div className={cn(ROW_GRID, "px-5 py-3")}>
      <div className="skeleton size-9 rounded-xl" />
      <div className="min-w-0 space-y-2">
        <div className="skeleton h-3.5 w-2/5" />
        <div className="skeleton h-3 w-1/4" />
      </div>
      <div className="skeleton h-5 w-14 rounded-md" />
      <div className="skeleton h-3.5 w-16 justify-self-end" />
      <div className="skeleton h-[22px] w-11 justify-self-end rounded-md" />
      <div className="skeleton h-3 w-8 justify-self-end" />
    </div>
  );
}

function JobsInner() {
  const params = useSearchParams();
  const selectedId = params.get("id");

  const q = useQuery<Paged<JobListItem>>({
    queryKey: ["jobs", 1],
    queryFn: () => apiFetch<Paged<JobListItem>>("/jobs?page=1&page_size=50"),
  });

  /* Load-more: page 1 via useQuery, later pages appended locally. */
  const [extra, setExtra] = useState<JobListItem[]>([]);
  const [more, setMore] = useState<"idle" | "loading" | "error">("idle");
  const [band, setBand] = useState<BandId>("all");
  const [cursor, setCursor] = useState(0);

  const items = useMemo(() => [...(q.data?.items ?? []), ...extra], [q.data, extra]);
  const totalCount = q.data?.total ?? 0;
  const pageSize = q.data?.page_size || PAGE_SIZE;
  const showLoadMore = !!q.data && totalCount > pageSize && items.length < totalCount;

  const counts = useMemo(() => {
    const c: Record<BandId, number> = { all: 0, ge80: 0, mid: 0, new: 0 };
    for (const j of items) for (const b of BANDS) if (b.test(j)) c[b.id] += 1;
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const def = BANDS.find((b) => b.id === band) ?? BANDS[0];
    return items.filter(def.test);
  }, [items, band]);

  const spotlight = Math.min(cursor, filtered.length - 1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (selectedId) return; // detail open — don't walk
      const t = e.target as HTMLElement | null;
      if (
        e.metaKey || e.ctrlKey || e.altKey ||
        (t instanceof HTMLInputElement) || (t instanceof HTMLTextAreaElement) ||
        (t instanceof HTMLSelectElement) || t?.isContentEditable
      ) return;
      if (e.key === "j") setCursor((c) => Math.min(c + 1, filtered.length - 1));
      if (e.key === "k") setCursor((c) => Math.max(c - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered.length, selectedId]);

  async function loadMore() {
    if (!q.data) return;
    setMore("loading");
    try {
      const next = await apiFetch<Paged<JobListItem>>(
        `/jobs?page=${Math.floor(items.length / pageSize) + 1}&page_size=${pageSize}`,
      );
      setExtra((e) => [...e, ...next.items]);
      setMore("idle");
    } catch {
      setMore("error");
    }
  }

  if (selectedId) {
    return <JobDetailPanel id={selectedId} onBack={() => history.replaceState(null, "", "/jobs/")} />;
  }

  return (
    <PageIn className="mx-auto max-w-6xl">
      {/* header: title + hints left, segmented bands + hero total right */}
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
        <div>
          <h1 className="text-[32px] font-semibold tracking-[-0.03em]">Job Inbox</h1>
          <p className="mt-2 text-sm text-muted">
            <kbd className="rounded border border-border/60 bg-surface-2/50 px-1 font-mono text-[10px]">j</kbd>
            <kbd className="ml-0.5 rounded border border-border/60 bg-surface-2/50 px-1 font-mono text-[10px]">k</kbd>{" "}
            to walk the inbox · click a row for the full brief
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <Segmented
            band={band}
            counts={counts}
            onChange={(b) => {
              setBand(b);
              setCursor(0);
            }}
          />
          <div className="text-right">
            <div className="hero-num text-[56px] leading-none text-text">
              <CountUp value={totalCount} />
            </div>
            <div className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
              jobs discovered
            </div>
          </div>
        </div>
      </div>

      {q.isLoading && (
        <Rise className="mt-8">
          <GlassCard hover={false} className="overflow-hidden">
            <TableHead />
            <div className="divide-y divide-border/60">
              {[...Array(6)].map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          </GlassCard>
        </Rise>
      )}

      {q.isError && (
        <Rise className="mt-8">
          <GlassCard hover={false} className="flex flex-col items-center py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl border border-neg/25 bg-neg/10">
              <AlertTriangle className="size-5 text-neg" />
            </div>
            <div className="mt-4 text-sm font-medium">Couldn&apos;t reach the jobs endpoint</div>
            <div className="mt-1.5 max-w-md text-xs leading-relaxed text-muted">
              {q.error instanceof Error ? q.error.message : "The sidecar didn't answer."} Live crawl
              lands with backend M1 (Greenhouse + Lever).
            </div>
            <button
              onClick={() => void q.refetch()}
              className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface-2/40 px-4 py-1.5 text-xs text-muted transition-colors hover:border-accent/40 hover:text-text"
            >
              <RefreshCw className="size-3" /> Try again
            </button>
          </GlassCard>
        </Rise>
      )}

      {q.data && items.length === 0 && (
        <Rise className="mt-8">
          <GlassCard hover={false} className="overflow-hidden">
            <div className="flex flex-col items-center justify-center py-16">
              <div className="flex size-14 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10">
                <Inbox className="size-6 text-accent" />
              </div>
              <div className="mt-4 text-lg font-semibold tracking-[-0.02em]">Inbox zero — for now</div>
              <div className="mt-1.5 max-w-md text-center text-xs leading-relaxed text-muted">
                The crawler sweeps company boards every 30 minutes. New matches land here with a
                score and a reason.
              </div>
            </div>
          </GlassCard>
        </Rise>
      )}

      {q.data && items.length > 0 && (
        <Rise className="mt-8">
          <GlassCard hover={false} className="overflow-hidden">
            <TableHead />
            <Stagger gap={0.025} className="divide-y divide-border/60">
              {filtered.map((j, i) => (
                <Rise key={j.id} y={8}>
                  <JobRow
                    job={j}
                    active={spotlight === i}
                    onOpen={() => history.replaceState(null, "", `/jobs/?id=${j.id}`)}
                  />
                </Rise>
              ))}
              {filtered.length === 0 && (
                <div className="px-5 py-12 text-center text-xs text-muted">
                  Nothing in this band yet — switch back to{" "}
                  <span className="text-text">All</span> or wait for the next sweep.
                </div>
              )}
            </Stagger>
          </GlassCard>
        </Rise>
      )}

      {showLoadMore && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            onClick={() => void loadMore()}
            disabled={more === "loading"}
            className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface-2/40 px-4 py-1.5 text-xs text-muted transition-colors hover:border-accent/40 hover:text-text disabled:opacity-60"
          >
            {more === "loading" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
            Showing {items.length} of {totalCount} — load more
          </button>
          {more === "error" && (
            <span className="text-[11px] text-neg">next page failed — try again</span>
          )}
        </div>
      )}
    </PageIn>
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={<div className="skeleton mx-auto mt-6 h-64 max-w-6xl" />}>
      <JobsInner />
    </Suspense>
  );
}
