"use client";

import { cn } from "@/lib/utils";

export type ScoreTone = "high" | "mid" | "low" | "skipped" | "none";

export function scoreTone(score: number | null, status: string): ScoreTone {
  if (["filtered_out", "skipped", "failed"].includes(status)) return "skipped";
  if (score == null) return "none";
  if (score >= 80) return "high";
  if (score >= 65) return "mid";
  return "low";
}

const STYLES: Record<ScoreTone, string> = {
  high: "text-score-high border-score-high/30 bg-score-high/10",
  mid: "text-score-mid border-score-mid/30 bg-score-mid/10",
  low: "text-score-low border-border bg-surface-2",
  skipped: "text-gate-fail border-gate-fail/25 bg-gate-fail/5",
  none: "text-muted border-border bg-surface-2",
};

const DOT: Record<ScoreTone, string> = {
  high: "bg-score-high",
  mid: "bg-score-mid",
  low: "bg-score-low",
  skipped: "bg-gate-fail",
  none: "bg-faint",
};

/** Compact match-score chip: tone dot + number (or status when unscored). */
export function ScoreChip({
  score,
  status,
  size = "md",
}: {
  score: number | null;
  status: string;
  size?: "sm" | "md" | "lg";
}) {
  const tone = scoreTone(score, status);
  const sizeCls =
    size === "lg"
      ? "gap-2 px-3 py-1.5 text-sm font-semibold rounded-xl"
      : size === "sm"
        ? "gap-1.5 px-2 py-0.5 text-[10px] rounded-md"
        : "gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg";
  const dot = size === "lg" ? "size-2" : "size-1.5";
  const label = score == null || tone === "skipped" ? status.replace(/_/g, " ") : String(Math.round(score));
  return (
    <span
      className={cn(
        "tnum inline-flex items-center border backdrop-blur-sm",
        sizeCls,
        STYLES[tone],
        tone === "skipped" && "line-through decoration-gate-fail/50",
      )}
    >
      <span className={cn("rounded-full", dot, DOT[tone])} />
      <span className="capitalize">{label}</span>
    </span>
  );
}
