import { http, HttpResponse } from "msw";

/*
 * MSW handlers — dev-only fixtures (FINAL_EXECUTION_PLAN D14).
 * Shapes match BACKEND_IMPLEMENTATION_SPEC.md §7 exactly so screens compile
 * and render before the real sidecar exists. Acceptance still requires the
 * live API.
 */

const health = {
  status: "ok",
  db: true,
  browser: { running: false },
  llm: { configured: false, degraded: false },
  scheduler: { crawl: "idle", match: "idle", apply: "idle" },
  caps_today: {
    linkedin: { used: 0, limit: 25 },
    ats: { used: 0, limit: 40 },
  },
  version: "0.1.0-mock",
  contract_version: "1",
};

// Week-0 demo fixture data (D14: dev-only, never shipped; live API replaces it at M1).
const demoJobs = [
  { id: "d1", title: "Senior Backend Engineer", company: "Stripe", company_logo_url: null,
    location: "US Remote", workplace_type: "remote", source: "greenhouse", ats_provider: "greenhouse",
    application_type: "ats_direct", match_score: 87.5, status: "scored" as const,
    salary: { min_amount: 140000, max_amount: 180000, currency: "USD", interval: "yearly" as const },
    date_posted: "2026-11-09T00:00:00Z", date_discovered: "2026-11-11T14:00:00Z" },
  { id: "d2", title: "Platform Engineer, Infra", company: "Ramp", company_logo_url: null,
    location: "New York, NY (Hybrid)", workplace_type: "hybrid", source: "lever", ats_provider: "lever",
    application_type: "ats_direct", match_score: 71.0, status: "scored" as const,
    salary: { min_amount: 130000, max_amount: 165000, currency: "USD", interval: "yearly" as const },
    date_posted: "2026-11-10T00:00:00Z", date_discovered: "2026-11-11T14:00:00Z" },
  { id: "d3", title: "Staff Software Engineer", company: "Notion", company_logo_url: null,
    location: "US Remote", workplace_type: "remote", source: "greenhouse", ats_provider: "greenhouse",
    application_type: "ats_direct", match_score: 62.5, status: "skipped" as const,
    salary: null,
    date_posted: "2026-11-08T00:00:00Z", date_discovered: "2026-11-11T14:00:00Z" },
  { id: "d4", title: "Backend Engineer, Payments", company: "Brex", company_logo_url: null,
    location: "US Remote", workplace_type: "remote", source: "ashby", ats_provider: "ashby",
    application_type: "ats_direct", match_score: 91.0, status: "ready_to_apply" as const,
    salary: { min_amount: 150000, max_amount: 190000, currency: "USD", interval: "yearly" as const },
    date_posted: "2026-11-11T00:00:00Z", date_discovered: "2026-11-11T14:00:00Z" },
];

const demoJobDetail = (id: string) => {
  const base = demoJobs.find((j) => j.id === id) ?? demoJobs[0];
  return {
    ...base,
    description_clean:
      "About the role\n\nYou will design and operate services that process millions of events per day.\n\nResponsibilities\n- Design, build, and operate distributed backend services\n- Own reliability, latency, and cost targets end to end\n- Mentor engineers and raise the code review bar\n\nRequirements\n- 5+ years building production systems in Python or Go\n- Strong API design and SQL skills; experience with Postgres and Redis\n- Track record of operating services in production (on-call, SLOs)\n\nNice to have\n- Kafka or equivalent streaming experience\n- Kubernetes and Terraform in production",
    parsed: {
      seniority_level: "senior",
      min_years_experience: 5,
      required_hard_skills: ["Python", "Postgres", "Redis", "API design", "Docker"],
      preferred_hard_skills: ["Kafka", "Kubernetes", "Terraform"],
      visa_sponsorship_statement: "unknown" as const,
      core_responsibilities: [
        "Design and operate distributed backend services",
        "Own reliability, latency, and cost targets",
        "Mentor engineers and raise the review bar",
      ],
    },
    score_breakdown: {
      final: base.match_score ?? 82,
      hard_gate: { passed: true, reasons: [] },
      components: { s_req: 0.91, s_pref: 0.7, s_vec: 0.82, s_llm: 0.88, s_exp: 1.0 },
      matched_skills: ["Python", "Postgres", "Redis", "Docker", "API design"],
      missing_skills: ["Kafka"],
      degraded: false,
    },
    tailored: null,
  };
};

export const handlers = [
  http.get("*/api/v1/health", () => HttpResponse.json(health)),
  http.get("*/api/v1/jobs", () =>
    HttpResponse.json({ items: demoJobs, total: demoJobs.length, page: 1, page_size: 50 })),
  http.get("*/api/v1/jobs/:id", ({ params }) => HttpResponse.json(demoJobDetail(String(params.id)))),
  http.post("*/api/v1/jobs/crawl", () =>
    HttpResponse.json({ started: true, sweep_id: "mock-sweep-1" })),
  http.post("*/api/v1/browser/launch", () =>
    HttpResponse.json({ running: true, executable: "mock", profile_path: "mock", logged_in: {} })),
  http.post("*/api/v1/profile", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...body, id: "profile-1", created_at: "2026-11-11T00:00:00Z" });
  }),
  http.get("*/api/v1/applications", () =>
    HttpResponse.json({ items: [], total: 0, page: 1, page_size: 50 })),
];
