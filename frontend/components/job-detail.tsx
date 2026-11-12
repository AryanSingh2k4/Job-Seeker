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
  MapPin, Briefcase, CircleCheck, CircleX, FileText, Gauge, Package, ArrowLeft,
} from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import type { JobListItem } from "@/lib/api/types";
import { GlassCard, PageIn, Rise } from "@/components/motion";
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
      <div className="mb-1 flex justify-between text-[11px]">
        <span className="text-muted">{COMPONENT_LABELS[k] ?? k}</span>
        <span className="tnum text-text">{Math.round(v * 100)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-accent to-accent-hover"
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(v * 100)}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 26, delay: 0.1 + i * 0.07 }}
          style={{ boxShadow: "0 0 10px -2px #e3b34c77" }}
        />
      </div>
    </div>
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
        <div className="skeleton h-10 w-40" />
        <div className="skeleton h-28" />
        <div className="skeleton h-64" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <div className="rounded-xl border border-gate-fail/25 bg-gate-fail/5 p-4 text-sm text-gate-fail">
        Could not load job {id.slice(0, 8)}… — endpoint live at backend M2.
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

      <div className="glass edge-glow rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <CompanyAvatar name={j.company} />
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{j.title}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                <span className="inline-flex items-center gap-1"><Briefcase className="size-3" />{j.company}</span>
                <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{j.location}</span>
                <span className="capitalize">{j.workplace_type}</span>
                <span>via {j.source}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <ScoreChip score={j.match_score} status={j.status} size="lg" />
            {b?.hard_gate && !b.hard_gate.passed && (
              <div className="mt-1 text-[10px] text-gate-fail">hard gate failed</div>
            )}
          </div>
        </div>

        <div className="mt-5 flex gap-1 border-b border-white/5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative flex items-center gap-1.5 px-3.5 py-2.5 text-xs transition-colors",
                tab === t.id ? "text-text" : "text-muted hover:text-text",
              )}
            >
              <t.icon className="size-3.5" /> {t.label}
              {tab === t.id && (
                <motion.span layoutId="job-tab" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />
              )}
            </button>
          ))}
        </div>

        <div className="pt-5">
          {tab === "job" && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              {j.parsed && (
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-md border border-accent/25 bg-accent/10 px-2 py-1 text-[11px] capitalize text-accent">
                    {j.parsed.seniority_level} · {j.parsed.min_years_experience}+ yrs
                  </span>
                  <span
                    className={cn(
                      "rounded-md border px-2 py-1 text-[11px]",
                      j.parsed.visa_sponsorship_statement === "not_supported"
                        ? "border-gate-fail/25 bg-gate-fail/10 text-gate-fail"
                        : "border-white/10 bg-white/[0.03] text-muted",
                    )}
                  >
                    visa: {j.parsed.visa_sponsorship_statement.replace("_", " ")}
                  </span>
                </div>
              )}
              {j.parsed && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="mb-2 text-[11px] uppercase tracking-wider text-muted">Required skills</div>
                    <div className="flex flex-wrap gap-1.5">
                      {j.parsed.required_hard_skills.map((s) => (
                        <span
                          key={s}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px]",
                            b?.matched_skills.includes(s)
                              ? "border-score-high/25 bg-score-high/10 text-score-high"
                              : "border-white/10 bg-white/[0.03] text-muted",
                          )}
                        >
                          {b?.matched_skills.includes(s) ? <CircleCheck className="size-3" /> : null}
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  {b && b.missing_skills.length > 0 && (
                    <div>
                      <div className="mb-2 text-[11px] uppercase tracking-wider text-muted">Missing</div>
                      <div className="flex flex-wrap gap-1.5">
                        {b.missing_skills.map((s) => (
                          <span key={s} className="inline-flex items-center gap-1 rounded-md border border-gate-fail/20 bg-gate-fail/5 px-2 py-0.5 text-[11px] text-gate-fail/90">
                            <CircleX className="size-3" /> {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 text-[13px] leading-relaxed text-muted">
                <pre className="whitespace-pre-wrap font-sans">{j.description_clean.slice(0, 1200)}…</pre>
              </div>
            </motion.div>
          )}

          {tab === "score" && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              {!b && <div className="text-sm text-muted">Scoring lands with backend M2. Current chip reflects the discovery-stage score.</div>}
              {b && (
                <>
                  {b.degraded && (
                    <div className="rounded-lg border border-score-mid/25 bg-score-mid/10 px-3 py-2 text-xs text-score-mid">
                      Degraded mode — LLM review skipped (no key or budget), scores use local signals only.
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <div className="tnum text-4xl font-semibold tracking-tight text-accent">{b.final.toFixed(1)}</div>
                    <div className="text-xs text-muted">
                      {b.hard_gate.passed ? "hard gates passed" : `gates failed: ${b.hard_gate.reasons.join(", ")}`}
                      <div className="text-[11px] text-muted/70">weights: 35% req · 15% pref · 20% vec · 20% llm · 10% exp</div>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {Object.entries(b.components).map(([k, v], i) => (
                      <ScoreBar key={k} k={k} v={v} i={i} />
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {tab === "artifacts" && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              {j.tailored ? (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
                    <span>Tailored resume (Typst PDF)</span>
                    <a
                      className="text-xs text-accent"
                      href="#"
                      onClick={async (e) => {
                        e.preventDefault();
                        const { ensureApi } = await import("@/lib/bootstrap");
                        const { baseUrl, token } = await ensureApi();
                        window.open(baseUrl + j.tailored!.resume_pdf_url, "_blank");
                        void token;
                      }}
                    >
                      open
                    </a>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
                    <span>Cover letter (.txt for form textareas)</span>
                    <a
                      className="text-xs text-accent"
                      href="#"
                      onClick={async (e) => {
                        e.preventDefault();
                        const { ensureApi } = await import("@/lib/bootstrap");
                        const { baseUrl } = await ensureApi();
                        window.open(baseUrl + j.tailored!.cover_letter_txt, "_blank");
                      }}
                    >
                      open
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted">
                  No tailored artifacts yet — approve this job to trigger tailoring (M3).
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </PageIn>
  );
}
