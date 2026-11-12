"use client";

/*
 * Master Profile — real screen: GET /profile (frozen contract §7.1). 404
 * profile_not_found → designed empty state with the onboarding CTA. Every
 * stat is computed from the payload only — nothing invented.
 */

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ArrowRight, BadgeCheck, Mail, MapPin, Phone, ShieldCheck, User } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/types";
import { CountUp, GlassCard, PageIn, Rise, Stagger } from "@/components/motion";
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
  start_date: string; // YYYY-MM
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
  source: string; // USER_VERIFIED | LLM_CACHED
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
          <div className="rounded-xl border border-neg/25 bg-neg/5 p-4 text-sm text-neg">
            Profile endpoint unreachable — is the sidecar up?
          </div>
        </Rise>
      )}

      {notFound && (
        <Rise className="pt-6">
          <GlassCard hover={false} className="flex flex-col items-center justify-center px-6 py-20">
            <div className="flex size-14 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10">
              <User className="size-6 text-accent" />
            </div>
            <div className="display mt-4 text-lg">No profile yet</div>
            <div className="mt-1.5 max-w-md text-center text-xs leading-relaxed text-muted">
              Ground truth starts here. Import your resume once — every fact becomes a claim the
              applier can prove, and every bullet is verified before it is ever used.
            </div>
            <button
              onClick={() => router.push("/onboarding/")}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg shadow-glow transition-colors hover:bg-accent-hover"
            >
              Start onboarding <ArrowRight className="size-4" />
            </button>
          </GlassCard>
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
        <Stagger className="space-y-7" gap={0.07}>
          {/* header */}
          <Rise>
            <div>
              <h1 className="display text-[40px] font-semibold tracking-[-0.03em]">{p.full_name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="size-3.5 text-accent" /> {p.email}
                </span>
                <span className="text-border">·</span>
                <span className="tnum inline-flex items-center gap-1.5">
                  <Phone className="size-3.5 text-accent" /> {p.phone}
                </span>
                <span className="text-border">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-accent" />
                  {[p.city, p.state].filter(Boolean).join(", ") || p.country}
                </span>
                <span className="text-border">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-accent" /> {p.work_authorization}
                </span>
              </div>
            </div>
          </Rise>

          {/* stat band */}
          <Rise>
            <GlassCard hover={false} className="grid grid-cols-3 divide-x divide-border/60">
              <div className="flex flex-col items-center px-4 py-6">
                <span className="hero-num tnum text-[56px] leading-none">
                  <CountUp value={p.skills.length} />
                </span>
                <span className="mt-2 text-[13px] font-medium text-muted uppercase tracking-[0.14em]">
                  Skills
                </span>
              </div>
              <div className="flex flex-col items-center px-4 py-6">
                <span className="hero-num tnum text-[56px] leading-none">
                  <CountUp value={p.work_experiences.length} />
                </span>
                <span className="mt-2 text-[13px] font-medium text-muted uppercase tracking-[0.14em]">
                  Experiences
                </span>
              </div>
              <div className="flex flex-col items-center px-4 py-6">
                <span className="hero-num tnum text-[56px] leading-none text-accent">
                  <CountUp
                    value={p.work_experiences.reduce((n, e) => n + e.bullets.filter((b) => b.verified).length, 0)}
                  />
                </span>
                <span className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted uppercase tracking-[0.14em]">
                  <BadgeCheck className="size-3.5 text-accent" /> Verified bullets
                </span>
              </div>
            </GlassCard>
          </Rise>

          {/* skills */}
          <Rise>
            <section>
              <div className="text-[13px] font-medium text-muted uppercase tracking-[0.14em]">Skills</div>
              {p.skills.length === 0 ? (
                <div className="mt-3 text-xs text-muted">
                  No skills captured yet — re-run onboarding to import them.
                </div>
              ) : (
                <div className="mt-3 space-y-4">
                  {Object.entries(
                    p.skills.reduce<Record<string, SkillOut[]>>((acc, s) => {
                      (acc[s.category] ??= []).push(s);
                      return acc;
                    }, {}),
                  )
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([cat, list]) => (
                      <div key={cat}>
                        <div className="mb-2 text-xs text-muted">{cat}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {[...list]
                            .sort(
                              (a, b) =>
                                (PROFICIENCY_RANK[a.proficiency] ?? 9) -
                                  (PROFICIENCY_RANK[b.proficiency] ?? 9) ||
                                a.canonical_name.localeCompare(b.canonical_name),
                            )
                            .map((s) => (
                              <span
                                key={s.id}
                                title={`${s.proficiency} · ${s.years_of_experience}y · last used ${s.last_used_year}`}
                                className={cn(
                                  "rounded-full border px-3 py-1 text-xs transition-colors",
                                  s.proficiency === "expert"
                                    ? "border-accent/30 bg-accent/10 text-accent"
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
              <div className="text-[13px] font-medium text-muted uppercase tracking-[0.14em]">
                Experiences
              </div>
              {p.work_experiences.length === 0 ? (
                <div className="mt-3 text-xs text-muted">
                  No work experience captured yet — re-run onboarding to import it.
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  {[...p.work_experiences]
                    .sort((a, b) => b.start_date.localeCompare(a.start_date))
                    .map((e) => {
                      const verified = e.bullets.filter((b) => b.verified).length;
                      return (
                        <GlassCard key={e.id} className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold">{e.role_title}</div>
                              <div className="mt-0.5 truncate text-sm text-muted">
                                {e.company_name} · {e.location} ({e.location_type})
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="tnum text-xs text-muted">
                                {fmtMonth(e.start_date)} —{" "}
                                {e.is_current || !e.end_date ? "Present" : fmtMonth(e.end_date)}
                              </div>
                              {e.bullets.length > 0 && (
                                <div className="tnum mt-1 inline-flex items-center gap-1 text-[10px] text-muted">
                                  <BadgeCheck
                                    className={cn(
                                      "size-3",
                                      verified > 0 ? "text-accent" : "text-muted",
                                    )}
                                  />
                                  {verified}/{e.bullets.length} bullets verified
                                </div>
                              )}
                            </div>
                          </div>
                          {e.technologies.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {e.technologies.map((t) => (
                                <span
                                  key={t}
                                  className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </GlassCard>
                      );
                    })}
                </div>
              )}
            </section>
          </Rise>

          {/* QA bank */}
          <Rise>
            <GlassCard hover={false} className="flex items-center justify-between gap-6 p-5">
              <div>
                <div className="text-[13px] font-medium text-muted uppercase tracking-[0.14em]">
                  QA knowledge bank
                </div>
                <div className="mt-1.5 text-xs leading-relaxed text-muted">
                  Pre-approved answers the applier can give on your behalf — verified ones are used
                  first.
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-5">
                <div className="text-center">
                  <div className="hero-num tnum text-[32px] leading-none">
                    <CountUp value={p.qa.length} />
                  </div>
                  <div className="mt-1 text-[10px] text-muted uppercase tracking-wider">answers</div>
                </div>
                <div className="space-y-1.5">
                  <div className="tnum rounded-full border border-pos/30 bg-pos/10 px-2.5 py-0.5 text-[10px] font-medium text-pos">
                    {p.qa.filter((a) => a.source === "USER_VERIFIED").length} verified
                  </div>
                  <div className="tnum rounded-full border border-warn/30 bg-warn/10 px-2.5 py-0.5 text-[10px] font-medium text-warn">
                    {p.qa.filter((a) => a.source === "LLM_CACHED").length} cached
                  </div>
                </div>
              </div>
            </GlassCard>
          </Rise>
        </Stagger>
      )}
    </PageIn>
  );
}
