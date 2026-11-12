"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Briefcase, MapPin, Search, Inbox } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import type { JobListItem, Paged } from "@/lib/api/types";
import { GlassCard, PageIn, Rise, Stagger } from "@/components/motion";
import { ScoreChip } from "@/components/score-chip";
import { cn } from "@/lib/utils";

function CompanyAvatar({ name }: { name: string }) {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 55% 32%), hsl(${(hue + 40) % 360} 60% 22%))`,
        boxShadow: `0 0 16px -6px hsl(${hue} 60% 40% / 0.7)`,
      }}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function SalaryTag({ job }: { job: JobListItem }) {
  if (!job.salary?.min_amount) return null;
  const fmt = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`);
  return (
    <span className="tnum rounded-md border border-white/5 bg-white/[0.03] px-1.5 py-0.5 text-[11px] text-muted">
      {fmt(job.salary.min_amount)}–{fmt(job.salary.max_amount ?? job.salary.min_amount)}
    </span>
  );
}

export default function JobsPage() {
  const q = useQuery<Paged<JobListItem>>({
    queryKey: ["jobs", 1],
    queryFn: () => apiFetch<Paged<JobListItem>>("/jobs?page=1&page_size=50"),
  });
  const [cursor, setCursor] = useState(0);
  const items = q.data?.items ?? [];

  // keyboard triage: j/k walk the inbox
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "j") setCursor((c) => Math.min(c + 1, items.length - 1));
      if (e.key === "k") setCursor((c) => Math.max(c - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length]);

  return (
    <PageIn className="mx-auto max-w-6xl">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Job Inbox</h1>
          <p className="mt-1 text-sm text-muted">
            {q.data ? `${q.data.total} discovered` : "loading…"} · <kbd className="rounded border border-white/10 px-1 font-mono text-[10px]">j</kbd>
            <kbd className="ml-0.5 rounded border border-white/10 px-1 font-mono text-[10px]">k</kbd> to walk · detail opens as{" "}
            <code className="font-mono text-xs">/jobs?id=…</code>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {["All", "≥80", "65–79", "New"].map((f, i) => (
            <button
              key={f}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-[11px] transition-colors",
                i === 0
                  ? "border-accent/30 bg-accent/10 text-accent"
                  : "border-white/5 bg-white/[0.02] text-muted hover:text-text",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {q.isLoading && (
        <div className="mt-6 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-[76px]" />
          ))}
        </div>
      )}

      {q.isError && (
        <Rise className="mt-6">
          <div className="rounded-xl border border-gate-fail/25 bg-gate-fail/5 p-4 text-sm text-gate-fail">
            Jobs endpoint unreachable — lands with backend M1 (Greenhouse + Lever crawl).
          </div>
        </Rise>
      )}

      {q.data && items.length === 0 && (
        <Rise className="mt-6">
          <GlassCard hover={false} className="flex flex-col items-center justify-center py-16">
            <div className="flex size-14 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10">
              <Inbox className="size-6 text-accent" />
            </div>
            <div className="mt-4 text-sm font-medium">Inbox zero — for now</div>
            <div className="mt-1 max-w-sm text-center text-xs text-muted">
              The crawler sweeps company boards every 30 minutes. New matches land here with a score and a reason.
            </div>
          </GlassCard>
        </Rise>
      )}

      {q.data && items.length > 0 && (
        <Stagger className="mt-6 space-y-2.5" gap={0.06}>
          {items.map((j, i) => (
            <motion.button
              key={j.id}
              variants={{
                hidden: { opacity: 0, y: 12 },
                show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 26 } },
              }}
              whileHover={{ scale: 1.008 }}
              onClick={() => setCursor(i)}
              className={cn(
                "glass edge-glow group block w-full rounded-xl p-4 text-left transition-colors",
                cursor === i ? "border-accent/40 shadow-glow-accent" : "hover:border-white/15",
              )}
            >
              <div className="flex items-center gap-4">
                <CompanyAvatar name={j.company} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{j.title}</span>
                    {j.application_type === "ats_direct" && (
                      <span className="rounded border border-prov-deterministic/25 bg-prov-deterministic/10 px-1.5 py-px text-[9px] uppercase tracking-wide text-prov-deterministic">
                        direct
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Briefcase className="size-3" /> {j.company}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3" /> {j.location}
                    </span>
                    <span className="capitalize">{j.workplace_type}</span>
                    <span className="text-muted/60">via {j.source}</span>
                    <SalaryTag job={j} />
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <ScoreChip score={j.match_score} status={j.status} />
                  <span className="text-[10px] text-muted/60">
                    {new Date(j.date_discovered).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </div>
              </div>
            </motion.button>
          ))}
        </Stagger>
      )}

      {items.length > 0 && (
        <div className="mt-4 flex items-center gap-1.5 text-[11px] text-muted/70">
          <Search className="size-3" /> full-text search + filters land with F2
        </div>
      )}
    </PageIn>
  );
}
