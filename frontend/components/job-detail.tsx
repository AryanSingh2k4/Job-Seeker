"use client";

/*
 * Job Detail — opened as /jobs?id=<uuid> (query route, D17).
 * Tabs: Job (JD + requirements) · Score (animated breakdown) · Artifacts.
 * Data: GET /jobs/{id} — mock in fixture mode, live at M2.
 */

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  MapPin, Briefcase, CircleCheck, CircleX, FileText, Gauge, Package, ArrowLeft, ArrowUpRight,
} from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import type { JobListItem } from "@/lib/api/types";
import { CountUp, GlassCard, PageIn, Rise, SPRING, Stagger } from "@/components/motion";
import { ScoreChip } from "@/components/score-chip";
import { CompanyAvatar } from "@/components/company-avatar";
import { cn } from "@/lib/utils";

export interface JobDetail extends JobListItem {
  description_clean: string;
  parsed: {
    seniority_level: string;
    min_years_experience: number;
    required_hard_skills: string[];
    preferred_hard_skills: string[];
    visa_sponsorship_statement: "supported" | "not_supported" | "unknown";
    core_responsibilities: string[];
  } | null;
  score_breakdown: {
    final: number;
    hard_gate: { passed: boolean; reasons: string[] };
    components: { s_req: number; s_pref: number; s_vec: number; s_llm: number; s_exp: number };
    matched_skills: string[];
    missing_skills: string[];
    degraded: boolean;
  } | null;
  tailored: { resume_pdf_url: string; cover_letter_txt: string; fact_check_status: string } | null;
}

const TABS = [
  { id: "job", label: "Job", icon: FileText },
  { id: "score", label: "Score", icon: Gauge },
  { id: "artifacts", label: "Artifacts", icon: Package },
] as const;

const COMPONENT_LABELS: Record<string, string> = {
  s_req: "Required skills",
  s_pref: "Preferred skills",
  s_vec: "Semantic fit",
  s_llm: "LLM review",
  s_exp: "Experience match",
};

function ScoreBar({ k, v, i }: { k: string; v: number; i: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs text-muted">{COMPONENT_LABELS[k] ?? k}</span>
        <span className="tnum font-mono text-xs text-text">{Math.round(v * 100)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-accent to-accent-strong"
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(v * 100)}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 26, delay: 0.1 + i * 0.07 }}
          style={{ boxShadow: "0 0 12px -2px #e08a5c66" }}
        />
      </div>
    </div>
  );
}

/* Opens artifact URLs through the sidecar origin (ensureApi), per contract. */
function ArtifactRow({ label, hint, url }: { label: string; hint: string; url: string }) {
  return (
    <Rise>
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-surface-2/40 px-4 py-3.5">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{label}</div>
          <div className="mt-0.5 text-[11px] text-muted">{hint}</div>
        </div>
        <a
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent-strong"
          href="#"
          onClick={async (e) => {
            e.preventDefault();
            const { ensureApi } = await import("@/lib/bootstrap");
            const { baseUrl } = await ensureApi();
            window.open(baseUrl + url, "_blank");
          }}
        >
          open <ArrowUpRight className="size-3.5" />
        </a>
      </div>
    </Rise>
  );
}

export function JobDetailPanel({ id, onBack }: { id: string; onBack: () => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("job");
  const q = useQuery<JobDetail>({
    queryKey: ["job", id],
    queryFn: () => apiFetch<JobDetail>(`/jobs/${id}`),
  });

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-10 w-44" />
        <div className="skeleton h-32" />
        <div className="skeleton h-64" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <div className="rounded-xl border border-neg/25 bg-neg/5 p-4 text-sm text-neg">
        Could not load job {id.slice(0, 8)}… —{" "}
        {q.error instanceof Error ? q.error.message : "endpoint live at backend M2"}.
      </div>
    );
  }

  const j = q.data;
  const b = j.score_breakdown;

  return (
    <PageIn className="mx-auto max-w-5xl">
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="size-3.5" /> back to inbox
      </button>

      <GlassCard hover={false} className="rounded-2xl p-7">
        {/* header: identity + meta left, score chip right */}
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
          <div className="flex min-w-0 items-start gap-4">
            <CompanyAvatar name={j.company} size={44} />
            <div className="min-w-0">
              <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em]">{j.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <span className="inline-flex items-center gap-1"><Briefcase className="size-3" />{j.company}</span>
                <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{j.location}</span>
                <span className="capitalize">{j.workplace_type}</span>
                <span>via {j.source}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <ScoreChip score={j.match_score} status={j.status} size="lg" />
            {b?.hard_gate && !b.hard_gate.passed && (
              <div className="text-[10px] text-neg">hard gate failed</div>
            )}
          </div>
        </div>

        {/* tabs — animated underline */}
        <div className="mt-6 flex gap-1 border-b border-border/60">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium transition-colors",
                tab === t.id ? "text-text" : "text-muted hover:text-text",
              )}
            >
              <t.icon className="size-3.5" /> {t.label}
              {tab === t.id && (
                <motion.span
                  layoutId="job-tab-underline"
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent shadow-glow"
                  transition={SPRING}
                />
              )}
            </button>
          ))}
        </div>

        <div className="pt-6">
          {tab === "job" && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING} className="space-y-6">
              {j.parsed && (
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-md border border-accent/25 bg-accent-soft px-2.5 py-1 text-[11px] font-medium capitalize text-accent">
                    {j.parsed.seniority_level} · {j.parsed.min_years_experience}+ yrs
                  </span>
                  <span
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-[11px] font-medium capitalize",
                      j.parsed.visa_sponsorship_statement === "not_supported"
                        ? "border-neg/25 bg-neg/10 text-neg"
                        : j.parsed.visa_sponsorship_statement === "supported"
                          ? "border-pos/25 bg-pos/10 text-pos"
                          : "border-border/60 bg-surface-2/50 text-muted",
                    )}
                  >
                    visa: {j.parsed.visa_sponsorship_statement.replace("_", " ")}
                  </span>
                </div>
              )}
              {j.parsed && (
                <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
                  <div>
                    <div className="mb-2.5 text-[13px] font-medium uppercase tracking-[0.14em] text-muted">
                      Required skills
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {j.parsed.required_hard_skills.map((s) => {
                        const matched = b?.matched_skills.includes(s) ?? false;
                        return (
                          <span
                            key={s}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium",
                              matched
                                ? "border-pos/25 bg-pos/10 text-pos"
                                : "border-border/60 bg-surface-2/50 text-muted",
                            )}
                          >
                            {matched && <CircleCheck className="size-3" />}
                            {s}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="mb-2.5 text-[13px] font-medium uppercase tracking-[0.14em] text-muted">
                      Missing
                    </div>
                    {!b ? (
                      <div className="text-xs text-muted">
                        Breakdown lands once the match engine scores this job.
                      </div>
                    ) : b.missing_skills.length === 0 ? (
                      <div className="inline-flex items-center gap-1.5 text-xs text-pos">
                        <CircleCheck className="size-3.5" /> every requirement covered
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {b.missing_skills.map((s) => (
                          <span
                            key={s}
                            className="inline-flex items-center gap-1 rounded-md border border-neg/25 bg-neg/10 px-2 py-1 text-[11px] font-medium text-neg"
                          >
                            <CircleX className="size-3" /> {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="glass-soft rounded-xl p-5 text-[13px] leading-relaxed text-muted">
                <pre className="whitespace-pre-wrap font-sans">{j.description_clean.slice(0, 1200)}…</pre>
              </div>
            </motion.div>
          )}

          {tab === "score" && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING} className="space-y-6">
              {!b && (
                <div className="text-sm text-muted">
                  Scoring lands with backend M2. Current chip reflects the discovery-stage score.
                </div>
              )}
              {b && (
                <>
                  {b.degraded && (
                    <div className="rounded-xl border border-warn/25 bg-warn/10 px-3.5 py-2.5 text-xs text-warn">
                      Degraded mode — LLM review skipped (no key or budget), scores use local signals only.
                    </div>
                  )}
                  <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
                    <div className="flex items-baseline gap-2">
                      <span className="hero-num text-[64px] leading-none text-text">
                        <CountUp value={b.final} decimals={1} />
                      </span>
                      <span className="text-lg font-medium text-muted">/100</span>
                    </div>
                    <div className="text-right">
                      <div className={cn("text-xs font-medium", b.hard_gate.passed ? "text-pos" : "text-neg")}>
                        {b.hard_gate.passed ? "hard gates passed" : `gates failed: ${b.hard_gate.reasons.join(", ")}`}
                      </div>
                      <div className="mt-1 text-[11px] text-muted">
                        weights: 35% req · 15% pref · 20% vec · 20% llm · 10% exp
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
                    {Object.entries(b.components).map(([k, v], i) => (
                      <ScoreBar key={k} k={k} v={v} i={i} />
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {tab === "artifacts" && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}>
              {j.tailored ? (
                <Stagger gap={0.08}>
                  <ArtifactRow label="Tailored resume" hint="Typst PDF" url={j.tailored.resume_pdf_url} />
                  <ArtifactRow label="Cover letter" hint=".txt for form textareas" url={j.tailored.cover_letter_txt} />
                </Stagger>
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface-2/40 px-4 py-3.5 text-sm text-muted">
                  <Package className="size-4 shrink-0 text-muted/70" />
                  No tailored artifacts yet — approve this job to trigger tailoring (M3).
                </div>
              )}
            </motion.div>
          )}
        </div>
      </GlassCard>
    </PageIn>
  );
}
