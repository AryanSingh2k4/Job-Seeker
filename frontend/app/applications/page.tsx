"use client";

/*
 * Applications — real screen: history table structure with a designed empty
 * state. Live rows arrive with backend M4; every audit field has a home.
 */

import { useQuery } from "@tanstack/react-query";
import { Download, FileSearch } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import type { Paged } from "@/lib/api/types";
import { PageIn, Rise } from "@/components/motion";
import { Button, EmptyState, PageHeader, Panel } from "@/components/ui";

const COLS = ["Date", "Company", "Role", "Platform", "Mode", "Status", "Duration", "Receipt"];
const COL_GRID = "grid grid-cols-[86px_minmax(0,1.1fr)_minmax(0,1.3fr)_92px_96px_110px_84px_120px] items-center gap-x-4";

export default function ApplicationsPage() {
  const q = useQuery<Paged<never>>({
    queryKey: ["applications", 1],
    queryFn: () => apiFetch<Paged<never>>("/applications?page=1&page_size=50"),
  });

  const empty = q.data && q.data.total === 0;

  return (
    <PageIn>
      <PageHeader
        eyebrow="Record"
        title="Applications"
        subtitle="The accountability ledger — every submission, its mode, duration and confirmation receipt, kept immutably."
        actions={
          <Button variant="outline" size="md" disabled>
            <Download className="size-4" /> Export
          </Button>
        }
      />

      {q.isLoading && (
        <Rise className="mt-10">
          <Panel className="overflow-hidden">
            <div className="border-b border-border/70 px-5 py-3">
              <div className={COL_GRID}>
                {COLS.map((c) => (
                  <span key={c} className="text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">
                    {c}
                  </span>
                ))}
              </div>
            </div>
            <div className="divide-y divide-border/60">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={`${COL_GRID} px-5 py-4`}>
                  {COLS.map((c) => (
                    <div key={c} className="skeleton h-3.5" />
                  ))}
                </div>
              ))}
            </div>
          </Panel>
        </Rise>
      )}

      {empty && (
        <Rise className="mt-10">
          <EmptyState
            icon={<FileSearch className="size-5" />}
            title="No applications yet"
            body="When a run submits, its row lands here with the proof — receipt, screenshot and duration. Until then this ledger stays empty."
          />
        </Rise>
      )}

      {q.isError && (
        <Rise className="mt-10">
          <Panel className="border-neg/30 bg-neg/5 p-5 text-sm text-neg">
            Applications endpoint unreachable — is the sidecar up?
          </Panel>
        </Rise>
      )}
    </PageIn>
  );
}
