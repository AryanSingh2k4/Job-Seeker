"use client";

/*
 * Job Inbox — discovery surface (§7.2 JobListItem). One hairline table, j/k
 * spotlight. Score bands and "fresh <24h" filter client-side over the fetched
 * items; load-more appends pages from GET /jobs?page=N.
 */

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { AlertTriangle, ChevronDown, Inbox, Loader2, MapPin, RefreshCw } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import type { JobListItem, Paged } from "@/lib/api/types";
import { CountUp, PageIn, Rise, SPRING, Stagger } from "@/components/motion";
import { Button, EmptyState, PageHeader, Panel } from "@/components/ui";
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
  { id: "ge80", label: "≥ 80", test: (j) => j.match_score != null && j.match_score >= 80 },
  {
    id: "mid",
    label: "65–79",
    test: (j) => j.match_score != null && j.match_score >= 65 && j.match_score < 80,
  },
  { id: "new", label: "New", test: (j) => Date.now() - new Date(j.date_discovered).getTime() < DAY_MS },
];

/* Shared row geometry: avatar | role | source | salary | score | found. */
const ROW_GRID = "grid grid-cols-[40px_minmax(0,1fr)_96px_108px_86px_64px] items-center gap-x-4";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function TableHead() {
  return (
    <div
      className={cn(
        ROW_GRID,
        "border-b border-border/70 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-faint",
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
  if (!s?.min_amount) return <span className="text-xs text-faint">—</span>;
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
    <span className="tnum font-mono text-[11px] text-muted">
      {hi ? `${lo}–${hi}` : lo}
      {suffix}
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  return (
    <span className="w-fit rounded-md border border-border/70 bg-surface-2/50 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-faint">
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
    <div className="inline-flex items-center rounded-full border border-border/70 bg-surface-2/40 p-1">
      {BANDS.map((b) => {
        const active = band === b.id;
        return (
          <button
            key={b.id}
            onClick={() => onChange(b.id)}
            className="relative rounded-full px-3.5 py-1.5 text-[12px] font-medium"
          >
            {active && (
              <motion.span
                layoutId="jobs-band-pill"
                className="absolute inset-0 rounded-full border border-accent/35 bg-accent-soft"
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
              <span className={cn("tnum font-mono text-[10px]", active ? "text-accent/70" : "text-faint")}>
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
        "group relative w-full px-5 py-3.5 text-left transition-colors duration-200 hover:bg-surface-2/60",
        active && "bg-surface-2/50",
      )}
    >
      <CompanyAvatar name={job.company} size={38} />
      <div className="min-w-0">
        <div className="truncate text-[13.5px] font-semibold text-text">{job.title}</div>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
          <span className="truncate">{job.company}</span>
          <span className="shrink-0 text-faint">·</span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{job.location}</span>
          </span>
          {job.workplace_type !== "unknown" && (
            <>
              <span className="shrink-0 text-faint">·</span>
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
        {fresh && <span title="discovered < 24h ago" className="size-1.5 shrink-0 rounded-full bg-accent shadow-glow" />}
        <span className="tnum text-[11px] text-muted">{fmtDate(job.date_discovered)}</span>
      </div>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-[2px] rounded-r transition-colors duration-200",
          active ? "bg-accent" : "bg-transparent group-hover:bg-accent/50",
        )}
      />
    </button>
  );
}

function SkeletonRow() {
  return (
    <div className={cn(ROW_GRID, "px-5 py-3.5")}>
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
    <PageIn>
      <PageHeader
        eyebrow="Discovery"
        title="Job inbox"
        subtitle={
          <>
            <kbd className="rounded border border-border/70 bg-surface-2/50 px-1.5 py-0.5 font-mono text-[10px] text-muted">j</kbd>
            <kbd className="ml-1 rounded border border-border/70 bg-surface-2/50 px-1.5 py-0.5 font-mono text-[10px] text-muted">k</kbd>{" "}
            to walk the list — open a row for the full brief, score and artifacts.
          </>
        }
        actions={
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
              <div className="hero-num text-[clamp(2.6rem,5vw,3.6rem)] leading-none text-text">
                <CountUp value={totalCount} />
              </div>
              <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
                jobs discovered
              </div>
            </div>
          </div>
        }
      />

      {q.isLoading && (
        <Rise className="mt-10">
          <Panel className="overflow-hidden">
            <TableHead />
            <div className="divide-y divide-border/60">
              {[...Array(6)].map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          </Panel>
        </Rise>
      )}

      {q.isError && (
        <Rise className="mt-10">
          <EmptyState
            icon={<AlertTriangle className="size-5" />}
            title="Couldn't reach the jobs endpoint"
            body={
              <>
                {q.error instanceof Error ? q.error.message : "The sidecar didn't answer."} Live crawl
                lands with backend M1 (Greenhouse + Lever).
              </>
            }
            action={
              <Button variant="outline" size="sm" onClick={() => void q.refetch()}>
                <RefreshCw className="size-3.5" /> Try again
              </Button>
            }
          />
        </Rise>
      )}

      {q.data && items.length === 0 && (
        <Rise className="mt-10">
          <EmptyState
            icon={<Inbox className="size-5" />}
            title="Inbox zero — for now"
            body="The crawler sweeps company boards every 5 minutes. New matches land here with a score and a reason."
          />
        </Rise>
      )}

      {q.data && items.length > 0 && (
        <Rise className="mt-10">
          <Panel className="overflow-hidden">
            <TableHead />
            <Stagger gap={0.02} className="divide-y divide-border/60">
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
                  Nothing in this band yet — switch back to <span className="text-text">All</span> or
                  wait for the next sweep.
                </div>
              )}
            </Stagger>
          </Panel>
        </Rise>
      )}

      {showLoadMore && (
        <div className="mt-5 flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" onClick={() => void loadMore()} disabled={more === "loading"}>
            {more === "loading" ? <Loader2 className="size-3.5 animate-spin" /> : <ChevronDown className="size-3.5" />}
            Showing {items.length} of {totalCount} — load more
          </Button>
          {more === "error" && <span className="text-[11px] text-neg">next page failed — try again</span>}
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
