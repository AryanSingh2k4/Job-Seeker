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
  high: "text-score-high border-score-high/30 bg-score-high/10 shadow-[0_0_18px_-4px_#6fcf9766]",
  mid: "text-score-mid border-score-mid/30 bg-score-mid/10 shadow-[0_0_18px_-4px_#f0b35c44]",
  low: "text-score-low border-border bg-surface-2",
  skipped: "text-gate-fail/90 border-gate-fail/25 bg-gate-fail/5 line-through decoration-gate-fail/60",
  none: "text-muted border-border bg-surface-2",
};

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
      ? "px-3 py-1 text-sm font-semibold rounded-lg"
      : size === "sm"
        ? "px-1.5 py-0.5 text-[10px] rounded"
        : "px-2 py-0.5 text-xs font-medium rounded-md";
  return (
    <span className={cn("tnum inline-flex items-center border backdrop-blur-sm", sizeCls, STYLES[tone])}>
      {tone === "skipped" ? status : score == null ? status : Math.round(score)}
    </span>
  );
}
