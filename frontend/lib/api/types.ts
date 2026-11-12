/*
 * API types — Week 0 hand-written core subset.
 *
 * NOTE (contract): generated types from `docs/contract/openapi-M{n}.json`
 * (openapi-typescript) replace this file as milestones land. Keep the shapes
 * here byte-compatible with BACKEND_IMPLEMENTATION_SPEC.md §7–8.
 */

export const CONTRACT_VERSION = "1";

export interface ApiErrorEnvelope {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

/** §7.0 Health */
export interface Health {
  status: string;
  db: boolean;
  browser: { running: boolean };
  llm: { configured: boolean; degraded: boolean };
  scheduler: { crawl: string; match: string; apply: string };
  caps_today: {
    linkedin: { used: number; limit: number };
    ats: { used: number; limit: number };
  };
  version: string;
  contract_version: string;
  runtime?: { mode: "sidecar" | "web_dev" };
}

/** §7.2 JobListItem */
export type JobStatus =
  | "discovered" | "filtered_out" | "score_queued" | "scored" | "skipped"
  | "tailoring" | "ready_to_apply" | "applying" | "applied" | "failed" | "archived";

export interface SalaryInfo {
  min_amount: number | null;
  max_amount: number | null;
  currency: string;
  interval: "hourly" | "monthly" | "yearly";
}

export interface JobListItem {
  id: string;
  title: string;
  company: string;
  company_logo_url: string | null;
  location: string;
  workplace_type: "remote" | "hybrid" | "onsite" | "unknown";
  source: string;
  ats_provider: string;
  application_type: string;
  match_score: number | null;
  status: JobStatus;
  salary: SalaryInfo | null;
  date_posted: string | null;
  date_discovered: string;
}
