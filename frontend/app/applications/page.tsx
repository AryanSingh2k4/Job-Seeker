"use client";

/*
 * Applications — real screen: history table structure with designed empty
 * state. Live rows arrive with backend M4; every audit field has a home.
 */

import { useQuery } from "@tanstack/react-query";
import { Download, FileSearch } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import type { Paged } from "@/lib/api/types";
import { GlassCard, PageIn, Rise } from "@/components/motion";

const COLS = ["Date", "Company", "Role", "Platform", "Mode", "Status", "Duration", "Receipt"];

export default function ApplicationsPage() {
  const q = useQuery<Paged<never>>({
    queryKey: ["applications", 1],
    queryFn: () => apiFetch<Paged<never>>("/applications?page=1&page_size=50"),
  });

  const empty = q.data && q.data.total === 0;

  return (
    <PageIn className="mx-auto max-w-6xl">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="display text-[30px] font-semibold">Applications</h1>
          <p className="mt-1.5 text-sm text-muted">
            The accountability record — every run, receipt, screenshot, and answer.
          </p>
        </div>
        <button
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-muted transition-colors hover:border-accent/40 hover:text-text"
          title="CSV export lands with M6"
        >
          <Download className="size-3.5" /> Export
        </button>
      </div>

      {q.isError && (
        <Rise className="mt-7">
          <div className="rounded-xl border border-neg/25 bg-neg/5 p-4 text-sm text-neg">
            Applications endpoint unreachable (backend M4).
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

      {q.data && empty && (
        <Rise className="mt-7">
          <GlassCard hover={false} className="overflow-hidden">
            <div className="grid grid-cols-8 gap-2 border-b border-border/60 px-5 py-3 text-[10px] uppercase tracking-wider text-muted">
              {COLS.map((c) => (
                <span key={c} className={c === "Company" || c === "Role" ? "col-span-2" : ""}>
                  {c}
                </span>
              ))}
            </div>
            <div className="flex flex-col items-center justify-center py-16">
              <div className="flex size-14 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10">
                <FileSearch className="size-6 text-accent" />
              </div>
              <div className="display mt-4 text-lg">Nothing applied yet</div>
              <div className="mt-1.5 max-w-md text-center text-xs leading-relaxed text-muted">
                When you approve a job, every step lands here — the form filled, the answers given
                (with provenance), the receipt, the screenshot. Nothing hides.
              </div>
            </div>
          </GlassCard>
        </Rise>
      )}

      {q.data && !empty && (
        <Rise className="mt-7">
          <GlassCard hover={false} className="overflow-hidden">
            <div className="grid grid-cols-8 gap-2 border-b border-border/60 px-5 py-3 text-[10px] uppercase tracking-wider text-muted">
              {COLS.map((c) => (
                <span key={c} className={c === "Company" || c === "Role" ? "col-span-2" : ""}>
                  {c}
                </span>
              ))}
            </div>
            <div className="px-5 py-6 text-sm text-muted">{q.data.total} rows</div>
          </GlassCard>
        </Rise>
      )}
    </PageIn>
  );
}
