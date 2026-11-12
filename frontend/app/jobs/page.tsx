"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import type { JobListItem, Paged } from "@/lib/api/types";

function ScoreChip({ score, status }: { score: number | null; status: string }) {
  if (["filtered_out", "skipped"].includes(status)) {
    return <span className="rounded px-2 py-0.5 text-xs text-gate-fail line-through">{status}</span>;
  }
  if (score == null) return <span className="rounded px-2 py-0.5 text-xs text-muted">{status}</span>;
  const tone =
    score >= 80 ? "text-score-high" : score >= 65 ? "text-score-mid" : "text-score-low";
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${tone}`}>{score.toFixed(0)}</span>;
}

export default function JobsPage() {
  const q = useQuery<Paged<JobListItem>>({
    queryKey: ["jobs", 1],
    queryFn: () => apiFetch<Paged<JobListItem>>("/jobs?page=1&page_size=50"),
  });

  return (
    <section className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight">Job Inbox</h1>
      <p className="mt-1 text-sm text-muted">
        Triage: approve · skip · archive. Detail view opens as <code className="font-mono">/jobs?id=…</code> (query route, D17).
      </p>

      {q.isError && (
        <div className="mt-6 rounded-lg border border-gate-fail/40 bg-gate-fail/10 p-4 text-sm text-gate-fail">
          Jobs endpoint unreachable — lands with backend M1 (Greenhouse + Lever crawl).
        </div>
      )}

      {q.data && (
        <div className="mt-6">
          <div className="text-xs text-muted">{q.data.total} jobs discovered</div>
          {q.data.items.length === 0 ? (
            <div className="mt-4 rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted">
              No jobs yet. The crawler fills this inbox every {30} minutes once M1 is live.
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-surface">
              {q.data.items.map((j) => (
                <li key={j.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-medium">{j.title}</div>
                    <div className="text-xs text-muted">
                      {j.company} · {j.location} · {j.source}
                    </div>
                  </div>
                  <ScoreChip score={j.match_score} status={j.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
