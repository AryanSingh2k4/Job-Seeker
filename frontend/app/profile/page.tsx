"use client";

/*
 * Master Profile — real screen: GET /profile (frozen contract §7.1). 404
 * profile_not_found → designed empty state with the onboarding CTA. Every stat
 * is computed from the payload only — nothing invented.
 */

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ArrowRight, BadgeCheck, Mail, MapPin, Phone, ShieldCheck, User } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/types";
import { CountUp, PageIn, Rise, Stagger } from "@/components/motion";
import { Button, EmptyState, PageHeader, Panel, SectionTitle, Stat } from "@/components/ui";
import { cn } from "@/lib/utils";

/* ---------- shapes (CandidateProfileOut — backend/app/schemas/profile.py) ---------- */

interface SkillOut {
  id: string;
  canonical_name: string;
  category: string;
  proficiency: string;
  years_of_experience: number;
  last_used_year: number;
  aliases: string[];
}

interface BulletOut {
  id: string;
  raw_text: string;
  verified: boolean;
  skills_used: string[];
  metrics_quantified: string[];
}

interface WorkExperienceOut {
  id: string;
  company_name: string;
  role_title: string;
  location: string;
  location_type: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  technologies: string[];
  bullets: BulletOut[];
}

interface QAKnowledgeItem {
  id?: string | null;
  category: string;
  question_canonical: string;
  answer_value: string;
  source: string;
}

interface ProfileData {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  work_authorization: string;
  summary_baseline: string;
  skills: SkillOut[];
  work_experiences: WorkExperienceOut[];
  qa: QAKnowledgeItem[];
}

/* ---------- helpers ---------- */

function fmtMonth(ym: string | null): string {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  const mi = Number(m);
  if (!y || !Number.isFinite(mi) || mi < 1 || mi > 12) return ym;
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][mi - 1]} ${y}`;
}

const PROFICIENCY_RANK: Record<string, number> = {
  expert: 0,
  advanced: 1,
  intermediate: 2,
  beginner: 3,
};

export default function ProfilePage() {
  const router = useRouter();
  const q = useQuery<ProfileData>({
    queryKey: ["profile"],
    queryFn: () => apiFetch<ProfileData>("/profile"),
  });

  const notFound = q.error instanceof ApiError && q.error.code === "profile_not_found";
  const p = q.data;

  return (
    <PageIn className="mx-auto max-w-4xl">
      {q.isError && !notFound && (
        <Rise>
          <Panel className="border-neg/30 bg-neg/5 p-5 text-sm text-neg">
            Profile endpoint unreachable — is the sidecar up?
          </Panel>
        </Rise>
      )}

      {notFound && (
        <Rise className="pt-4">
          <EmptyState
            icon={<User className="size-5" />}
            title="No profile yet"
            body="Ground truth starts here. Import your resume once — every fact becomes a claim the applier can prove, and every bullet is verified before it is ever used."
            action={
              <Button variant="primary" size="lg" onClick={() => router.push("/onboarding/")}>
                Start onboarding <ArrowRight className="size-4" />
              </Button>
            }
          />
        </Rise>
      )}

      {q.isLoading && (
        <div className="space-y-4">
          <div className="skeleton h-24" />
          <div className="skeleton h-32" />
          <div className="skeleton h-40" />
        </div>
      )}

      {p && (
        <Stagger className="space-y-8" gap={0.07}>
          {/* header */}
          <Rise>
            <div>
              <h1 className="display text-[clamp(2.3rem,4.2vw,3.4rem)] leading-[0.98] text-text">
                {p.full_name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-muted">
                <span className="inline-flex items-center gap-1.5"><Mail className="size-3.5 text-accent" /> {p.email}</span>
                <span className="text-faint">·</span>
                <span className="tnum inline-flex items-center gap-1.5"><Phone className="size-3.5 text-accent" /> {p.phone}</span>
                <span className="text-faint">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-accent" />
                  {[p.city, p.state].filter(Boolean).join(", ") || p.country}
                </span>
                <span className="text-faint">·</span>
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-accent" /> {p.work_authorization}</span>
              </div>
            </div>
          </Rise>

          {/* stat band */}
          <Rise>
            <Panel className="grid grid-cols-3 divide-x divide-border/60">
              <div className="px-6 py-7"><Stat label="Skills" value={<CountUp value={p.skills.length} />} /></div>
              <div className="px-6 py-7"><Stat label="Experiences" value={<CountUp value={p.work_experiences.length} />} /></div>
              <div className="px-6 py-7">
                <Stat
                  label="Verified bullets"
                  value={
                    <CountUp
                      value={p.work_experiences.reduce((n, e) => n + e.bullets.filter((b) => b.verified).length, 0)}
                      className="text-accent"
                    />
                  }
                />
              </div>
            </Panel>
          </Rise>

          {/* skills */}
          <Rise>
            <section>
              <SectionTitle>Skills</SectionTitle>
              {p.skills.length === 0 ? (
                <div className="mt-4 text-xs text-muted">
                  No skills captured yet — re-run onboarding to import them.
                </div>
              ) : (
                <div className="mt-4 space-y-5">
                  {Object.entries(
                    p.skills.reduce<Record<string, SkillOut[]>>((acc, s) => {
                      (acc[s.category] ??= []).push(s);
                      return acc;
                    }, {}),
                  )
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([cat, list]) => (
                      <div key={cat}>
                        <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{cat}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {[...list]
                            .sort(
                              (a, b) =>
                                (PROFICIENCY_RANK[a.proficiency] ?? 9) - (PROFICIENCY_RANK[b.proficiency] ?? 9) ||
                                a.canonical_name.localeCompare(b.canonical_name),
                            )
                            .map((s) => (
                              <span
                                key={s.id}
                                title={`${s.proficiency} · ${s.years_of_experience}y · last used ${s.last_used_year}`}
                                className={cn(
                                  "rounded-full border px-3 py-1 text-xs transition-colors",
                                  s.proficiency === "expert"
                                    ? "border-accent/35 bg-accent-soft text-accent"
                                    : "border-border bg-surface-2 text-text hover:border-accent/40",
                                )}
                              >
                                {s.canonical_name}
                              </span>
                            ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </section>
          </Rise>

          {/* experiences */}
          <Rise>
            <section>
              <SectionTitle>Experiences</SectionTitle>
              {p.work_experiences.length === 0 ? (
                <div className="mt-4 text-xs text-muted">
                  No work experience captured yet — re-run onboarding to import it.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {[...p.work_experiences]
                    .sort((a, b) => b.start_date.localeCompare(a.start_date))
                    .map((e) => {
                      const verified = e.bullets.filter((b) => b.verified).length;
                      return (
                        <Panel key={e.id} spot className="p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold">{e.role_title}</div>
                              <div className="mt-0.5 truncate text-sm text-muted">
                                {e.company_name} · {e.location} ({e.location_type})
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="tnum text-xs text-muted">
                                {fmtMonth(e.start_date)} — {e.is_current || !e.end_date ? "Present" : fmtMonth(e.end_date)}
                              </div>
                              {e.bullets.length > 0 && (
                                <div className="tnum mt-1.5 inline-flex items-center gap-1 text-[10px] text-faint">
                                  <BadgeCheck className={cn("size-3", verified > 0 ? "text-accent" : "text-faint")} />
                                  {verified}/{e.bullets.length} bullets verified
                                </div>
                              )}
                            </div>
                          </div>
                          {e.technologies.length > 0 && (
                            <div className="mt-3.5 flex flex-wrap gap-1.5">
                              {e.technologies.map((t) => (
                                <span key={t} className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </Panel>
                      );
                    })}
                </div>
              )}
            </section>
          </Rise>

          {/* QA bank */}
          <Rise>
            <Panel className="flex flex-wrap items-center justify-between gap-6 p-6">
              <div className="min-w-0">
                <SectionTitle>QA knowledge bank</SectionTitle>
                <div className="mt-2 max-w-md text-xs leading-relaxed text-muted">
                  Pre-approved answers the applier can give on your behalf — verified ones are used first.
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-6">
                <div className="text-center">
                  <div className="hero-num tnum text-[36px] leading-none">
                    <CountUp value={p.qa.length} />
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-faint">answers</div>
                </div>
                <div className="space-y-2">
                  <div className="tnum rounded-full border border-pos/30 bg-pos/10 px-3 py-0.5 text-[10px] font-semibold text-pos">
                    {p.qa.filter((a) => a.source === "USER_VERIFIED").length} verified
                  </div>
                  <div className="tnum rounded-full border border-warn/30 bg-warn/10 px-3 py-0.5 text-[10px] font-semibold text-warn">
                    {p.qa.filter((a) => a.source === "LLM_CACHED").length} cached
                  </div>
                </div>
              </div>
            </Panel>
          </Rise>
        </Stagger>
      )}
    </PageIn>
  );
}
