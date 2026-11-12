# Auto-Job Plan: Independent Critical Review

> **STATUS: INCORPORATED (2026-11-11).** All critical fixes, contract unifications, and the MVP re-cut in this review have been folded into the plan documents, now at **v2.0.0 (website-only architecture)**. This file is retained as the review record and change rationale. The one architectural change made *after* this review — dropping the Chrome extension entirely and moving HITL review into the visible automation browser + website — was requested by the product owner and is documented in `ARCHITECTURE_PLAN.md` §0.
>
> **v2.1 note (2026-11-11):** the frontend is now Next.js running as a local process, and the build runs as two parallel agent tracks (backend: Gemini Antigravity; frontend + integration: OpenCode). The findings below are unchanged and still the rationale for v2. Execution details: `docs/FINAL_EXECUTION_PLAN.md`.

**Reviewer:** ZCode (independent review, not part of the original swarm)
**Date:** 2026-11-10
**Inputs reviewed:** `ARCHITECTURE_PLAN.md` v1.0.0, `docs/JOB_DISCOVERY_ENGINE_DESIGN.md`, `docs/ATS_MATCHING_AND_TAILORING_SPEC.md`, `docs/form_automation_engine_design.md`, `docs/SAFETY_AND_RISK_AUDIT_REPORT.md`, `core/models/job.py`

---

## 1. Verdict

| Dimension | Score | Comment |
| :--- | :---: | :--- |
| Research breadth & domain literacy | 9/10 | Source tiers, ATS adapters, Q&A tiers, anti-fabrication design are genuinely strong |
| Technical accuracy | 6/10 | One core architectural blocker missed (Chrome 136 CDP restriction), several overstated claims |
| Execution realism (can one dev ship this?) | 3/10 | 9-week Gantt for ~5 subsystems is 3–6 months of real work; no MVP cut exists |
| Internal consistency | 5/10 | Conflicting thresholds, three different status vocabularies, two audit stores |
| Honesty of the self-audit | 3/10 | The "verifier" doc is self-review theater; ToS "VERIFIED COMPLIANT" is wrong for LinkedIn |
| Frontend | 1/10 | One line of stack; zero screens, routes, flows, or specs (now addressed separately) |

**Overall: a strong research/design artifact, not a buildable plan as-is.** Keep it as the vision document; cut an MVP out of it; fix the browser-runtime design before any applier code is written.

---

## 2. What the plan gets right (keep these)

1. **Tiered discovery with direct ATS APIs first** (Greenhouse/Lever/Ashby boards are public, structured, zero-detection-risk). This is the correct strategic core.
2. **Zero-fabrication tailoring via bullet-pool selection + immutable metrics + diff guardrail.** Selection-based generation instead of freeform LLM writing is the single best design decision in the plan.
3. **HITL-by-default submission, zero CAPTCHA bypass, rate caps, working-hours window, 14-day company cooldown.** The ethics/safety posture is real, not decorative.
4. **Prompt-injection sanitization of JDs.** Correctly treats scraped job descriptions as untrusted LLM input. Most plans miss this.
5. **The form-automation doc is technically the strongest** — native prototype setters for React inputs, `DOM.setFileInputFiles`, option snapping, modal-discard recovery are all real, correct techniques.
6. SQLite + WAL + SQLAlchemy dialect-agnostic modeling for a local single-user app — right call vs. Postgres-in-Docker.

---

## 3. Critical flaws

### CRITICAL-1: The core automation premise is broken by Chrome ≥136
The plan's central mechanism (ARCHITECTURE_PLAN §4.3.1, form doc §2.3): *"Connects Playwright via CDP (localhost:9222) to the candidate's real, running Google Chrome instance"* and *"inherits existing login sessions."*

**Reality:** Since Chrome 136 (May 2025), `--remote-debugging-port` and `--remote-debugging-pipe` are **ignored when Chrome runs with the default user-data directory** (security change against cookie-theft malware). Today's Chrome cannot expose CDP on the everyday profile at all. Sources: developer.chrome.com/blog/remote-debugging-port; github.com/browser-use/browser-use/issues/1520.

**Consequences:** You cannot attach to the user's daily Chrome with existing LinkedIn/Workday logins. The plan never mentions launching Chrome, profile management, or first-run login — there is no Browser Runtime Manager component.

**Required redesign (pick one, recommend A+C):**
- **A. Dedicated automation profile**: Auto-Job launches `chrome --remote-debugging-port=9222 --user-data-dir=<app-managed-dir>`. Real Chrome, real fingerprint/hardware/IP (the stealth argument survives), but the user logs in once per platform inside this profile and sessions persist. Add a first-run login wizard + `/health/browser` launch-or-attach logic.
- **B. Copy the default User Data dir** — works on Windows (DPAPI keys are per-Windows-user, cookies stay decryptable) but copies diverge immediately and it's brittle. Don't build on this.
- **C. Extension-as-executor** for LinkedIn only: the MV3 companion (already in the plan) does the filling in the *real* browser; the daemon orchestrates. Slower, limited, but sidesteps CDP entirely.

### CRITICAL-2: The "audit" is self-review, and its ToS conclusion is wrong
`SAFETY_AND_RISK_AUDIT_REPORT.md` awards the plan 9.0–10.0 self-assigned scores and "VERIFIED (COMPLIANT)" on ToS. Two problems:
- The reviewer is the same authoring system; the scores are unfalsifiable marketing.
- On ToS substance: LinkedIn User Agreement §8.2 prohibits **automated access — full stop**. Flying under detection (real Chrome, jitter, caps) reduces ban *probability*; it does not make the activity compliant. The honest framing is: "LinkedIn automation is a user-accepted ToS violation risk; direct ATS forms (Greenhouse/Lever/Ashby) carry no such risk and are the default; LinkedIn is opt-in with an explicit risk acknowledgment screen." The plan's architecture effectively does this already — the docs just mislabel it as "compliance."

### CRITICAL-3: No MVP — the plan front-loads 6 weeks before the user gets any value
Phase 1–2 build crawler + matcher + tailorer + adapters + extension before anything applies for a job. The realistic walking skeleton is 2 weeks: Greenhouse+Lever ingestion → score → dashboard list → "open application URL" (manual apply). Then layer tailoring, then assisted auto-fill, then LinkedIn. The Gantt also assumes zero selector-rot maintenance; every adapter is a permanent maintenance liability (see MINOR list). Estimated honestly: 3–6 months solo for the full scope.

### CRITICAL-4: Fragile dependencies presented as stable
- **python-jobspy** ("Low–Medium risk, 300–800ms"): LinkedIn guest endpoints and Indeed Cloudflare protection churn constantly; jobspy breaks repeatedly and needs version pinning + a breakage budget. Treat Tier 2 as best-effort, circuit-breakered (the plan's breakers are good — keep them), and expect Tier 1 (direct ATS) to carry the load.
- **"Typst <30ms, ATS parse score 100/100, verified against Workday/Taleo/Greenhouse parsers"**: nothing was verified — no code exists. Typst speed is plausible; the "verified" claims are fabricated authority. Strike them.
- **"Pre-loaded registry of 500+ top tech employers"**: no source exists. Seed it from public Greenhouse/Lever board-token lists on GitHub (~500 tokens is achievable) — but that's a work item, not a given.

---

## 4. Internal inconsistencies (fix before implementation)

| # | Conflict | Where |
| :--- | :--- | :--- |
| 1 | Autonomous-mode match threshold: **≥80%** vs **≥95%** | form doc §6.1 ("Match score >= 80%") vs ARCHITECTURE_PLAN §7-Phase3 + audit §5.3 (95%) |
| 2 | Autonomous-mode platforms: form doc lists **LinkedIn Easy Apply** as trusted-autonomous; master plan restricts autonomous to gated ATS ≥95% | form doc §6.1 vs master §4.3.5 |
| 3 | Job status vocabulary: `job.py` (MATCHED/TAILORING/READY_TO_APPLY/APPLYING…) vs DDL comment (`discovered, match_queued, staged, applied…`) vs sequence diagram (`staged_for_apply`) | three different enum sets across artifacts |
| 4 | Audit store: standalone `application_audit.sqlite` vs unified `applications` + `audit_logs` tables | form doc §6.4 vs master §5 DDL |
| 5 | "PostgreSQL 14+ compatible" DDL opens with SQLite-only `PRAGMA` statements | master §5 DDL header |
| 6 | MV3 extension "WebSocket telemetry" — MV3 service workers die after ~30s idle (the form doc itself notes this); long-lived WS needs an offscreen document/page, not the worker | form doc §2.1 vs §4 telemetry |
| 7 | `datetime.utcnow` default — deprecated (Python 3.12+) | `job.py:119` |
| 8 | Ashby adapter in Phase-2 deliverables but absent from the Gantt; E2E tests appear only in Phase 3 | master §7 |

---

## 5. What's missing entirely

1. **Frontend design** — screens, routes, flows, states, API bindings. (Addressed in the new `FRONTEND_DASHBOARD_DESIGN.md`.)
2. **LLM cost model** — per job: JD extraction + LLM eval + tailoring + cover letter ≈ 8–10k tokens; at ~50 scored jobs/day that's ~0.5M tokens/day. Affordable but must be budgeted, with a cheap-first routing rule (deterministic → local embedding → frontier LLM only for finalists).
3. **Resume import reality** — `POST /profile/upload-resume -> Parse PDF into Master Profile` is one line for what is genuinely a hard extraction problem ending in a mandatory human review UI (bullet-pool editor). Scope it as its own feature.
4. **Cookie-vault key management** — "AES-GCM with user-derived key" is unspecified. Concretely: encryption key in the OS keyring (Windows Credential Manager via `keyring`), ciphertext on disk.
5. **Testing strategy** — adapters need recorded-HTML fixture tests (save real Greenhouse/Lever/LinkedIn pages, replay selectors); otherwise every refactor is a live-site gamble.
6. **DB backup/export** — the application history is the user's most valuable artifact; one `sqlite3 .backup` on a schedule.
7. **Localization nit** — LinkedIn `aria-label` selectors ("Continue to next step") are UI-language dependent; match on `data-test-*`/roles/text-keywords instead.

---

## 6. Recommended re-cut (v1 in ~4 weeks, hardening after)

- **Week 1 — Skeleton:** FastAPI + SQLite + profile model; Greenhouse/Lever ingestion for a seeded company list; dedup; job list in the web UI (no Tauri yet). *Value: private, fast job feed.*
- **Week 2 — Scoring:** JD parse (LLM) + skills-overlap + hard gates; job inbox with match breakdown detail. Embeddings/LLM-eval weights can come later.
- **Week 3 — Tailoring:** bullet-pool selection, Typst template, cover letter, fact-diff guardrail, PDF preview + approve/skip in UI.
- **Week 4 — Applier v1 (Greenhouse + Lever only):** dedicated automation Chrome profile + login wizard, assisted-review flow with final human click, audit log + screenshots. *This is the shippable end-to-end product.*
- **Week 5+:** LinkedIn Easy Apply behind an explicit ToS-risk opt-in; Ashby; extension HUD; autonomous mode (≥95% gate); Workday; Tauri packaging; analytics.

---

## 7. Bottom line

The swarm produced an impressive **design corpus** — the discovery tiering, anti-fabrication pipeline, and safety posture are genuinely well-reasoned and worth keeping nearly verbatim. But it is **not an implementation-ready plan**: the headline automation mechanism was invalidated by a Chrome security change the docs never noticed, the self-audit overstates compliance and verification, internal contracts contradict each other in at least eight places, the 9-week timeline ignores maintenance reality, and the frontend — half the product — was never designed. Fix CRITICAL-1 through CRITICAL-4, adopt the MVP cut, and this becomes a strong build.
