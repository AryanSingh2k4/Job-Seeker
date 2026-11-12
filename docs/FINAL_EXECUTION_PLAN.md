# JobSeeker — Final Execution Plan

**Version:** 1.1.0 (Tauri 2 desktop revision)
**Date:** 2026-11-11
**Status:** Operational single source of truth. Where this document conflicts with an older doc, **this document wins** (see §10 Decisions Log).
**Working name:** `JobSeeker` (repo) · **Recommended product name:** **JobSeeker**
**Build partners:** Gemini Antigravity (backend + sidecar packaging) · OpenCode (Next.js frontend + Tauri shell + integration lead/reviewer)
**Companion docs:** `ARCHITECTURE_PLAN.md`, `docs/BACKEND_IMPLEMENTATION_SPEC.md`, `docs/FRONTEND_DASHBOARD_DESIGN.md`, `docs/DESKTOP_PACKAGING_SPEC.md`, and the four component specs.

---

## 0. The one-paragraph version

JobSeeker is a private, local **desktop application** that finds jobs for one person, scores them against that person's **verified** resume, builds truthful tailored resumes and cover letters, and fills application forms in a **visible Chrome window** — stopping before Submit so the human makes the final call. It ships as a Windows installer: a Tauri 2 shell hosting a Next.js dashboard, a bundled Python sidecar (FastAPI + SQLite), and a dedicated automation browser. No cloud, no accounts, no extension, no spray-and-pray.

### Naming — DECIDED

**Product name: `JobSeeker`** (owner decision, 2026-11-11; previously codename `Auto-Job`, candidate name `Attest`). Considered alternates: *Callback* (programmer pun), *RolePilot* (copilot for roles).

- All document titles and user-visible naming now say **JobSeeker**.
- The repo folder (`Auto-Job/`) and internal technical identifiers are **unchanged** — `autojob-core.exe`, the `AUTOJOB_READY` handshake token, `AUTOJOB_*` env vars, and `data/autojob.db` stay as-is. Renaming wire-level identifiers would be pure churn; they are not user-visible. A future cleanup may alias them to `JOBSEEKER_*` if the owner wants.

---

## 1. What it does — in plain words

### The user story

1. **Teach it who you are (once).** Upload your resume. The app extracts a draft and asks you to confirm or edit **every bullet and every number**. Nothing is trusted until you tick it. Unconfirmed facts never appear on a resume.
2. **It finds jobs while you are away.** Every 30 minutes it polls public company job boards (Greenhouse, Lever, Ashby). Optionally — and only after a typed risk acknowledgment — it also sweeps LinkedIn/Indeed best-effort.
3. **It scores each job against the real you.** Required skills, preferred skills, semantic fit, a second-opinion LLM review, and years alignment — plus hard gates for visa, location, and seniority. The screen shows the exact breakdown, including the skills you are missing.
4. **It shows a shortlist, not a wall.** ≥80 green (auto-stage), 65–79 amber (your call), <65 grey (skipped with a logged reason).
5. **You approve; it tailors.** It never writes new claims: it **selects and orders** your verified bullets, reorders skills, and picks a pre-written summary sentence. If any number changes, the fact-check fails and the system falls back to your baseline resume. The cover letter is assembled from the same facts.
6. **It applies, visibly.** A real Chrome window opens, fills contact fields, uploads the PDF, answers screening questions from your saved QA bank (deterministic answers first; work-auth/visa/criminal/clearance/exact-years are never guessed), and stops at the final review screen.
7. **You click Submit.** Either in the browser window (primary path) or via "Approve & Submit" on the dashboard, which makes the backend click it. Both paths produce a confirmation receipt and a full-page screenshot.
8. **You keep the record.** Every application, every answer, its provenance (`DETERMINISTIC` / `LLM_GENERATED` / `USER_OVERRIDE` / `UNRESOLVED`), and its screenshot live in one history screen.

### What it will never do

- Invent experience, employers, dates, tools, or numbers.
- Solve or bypass a CAPTCHA.
- Exceed daily caps, ignore working hours, or apply to the same company twice in 14 days.
- Use proxy pools, residential IPs, stealth plugins, or `navigator.webdriver` patching.
- Submit without a human unless the user explicitly opts into the quadruple-gated autonomous mode (non-LinkedIn ATS + match ≥95 + 100% deterministic Q&A + opt-in).
- Send data anywhere except the LLM provider the user configures (and only the text that task needs).

### Who it is for

One technical job-seeker on Windows who would rather send 15 excellent, truthful applications than 300 generated ones.

---

## 2. Who builds what

| Area | Owner | Writes to | Never touches |
| :--- | :--- | :--- | :--- |
| Backend (crawler, matcher, tailor, applier, API, WS, DB, sidecar packaging) | **Gemini Antigravity** | `backend/**` (includes `backend/templates/`, `backend/fixtures/`, `backend/tests/`, `backend/packaging/`) | `frontend/**`, `desktop/**`, `docs/**` (except review responses) |
| Frontend (Next.js dashboard) | **OpenCode** | `frontend/**` | `backend/**`, `desktop/**` |
| Desktop shell (Tauri 2, installer, updater, CI) | **OpenCode** | `desktop/**`, `scripts/**` | `backend/**` implementation |
| Contract, docs, review gates, integration | **OpenCode** (integration lead) | `docs/**`, `scripts/**`, `ARCHITECTURE_PLAN.md` | backend implementation files |
| Schema/spec disputes | OpenCode decides | `docs/FINAL_EXECUTION_PLAN.md` §10 | — |

**Contract-first rule:** the frontend is built against `docs/BACKEND_IMPLEMENTATION_SPEC.md` §7–8, not against whatever the backend happens to return today. Endpoint or payload changes are negotiated *before* they are coded.

---

## 3. System shape

```
┌──────────────────────────────────────────────────────────────┐
│ JobSeeker.exe  (Tauri 2 shell, Rust)                            │
│  window (WebView2) · tray · updater · notifications          │
│  supervisor for the sidecar · single-instance guard          │
└───────────────┬──────────────────────────────┬───────────────┘
                │ static UI                    │ spawn + supervise
                ▼                              ▼
      frontend/out (Next.js export)      autojob-core.exe (Python)
      http://tauri.localhost             127.0.0.1:<random port>
                │                              │
                └──────── REST + WS ───────────┤ (Bearer token)
                                               ├── SQLite (WAL)
                                               ├── artifacts
                                               └── Playwright → visible Chrome
```

One machine, one user, three processes: the Tauri shell, the Python sidecar, and the automation Chrome. The shell owns the window and lifecycle; the sidecar owns all business logic and never renders UI; Chrome is a separate visible window the user can watch and take over.

### Runtime modes

| Mode | UI | Backend | Auth |
| :--- | :--- | :--- | :--- |
| **Desktop (shipped)** | Tauri WebView2 loads `frontend/out` | PyInstaller sidecar on an OS-assigned port | Per-launch bearer token + Host check |
| **Web dev** | `next dev` on `:3000` | `uvicorn` on `:8000` | None (localhost only) |
| **Static preview** (optional) | `npx serve frontend/out` | `uvicorn` on `:8000` | None (localhost only) |

Desktop packaging details live in `docs/DESKTOP_PACKAGING_SPEC.md`. The frozen HTTP contract is unchanged; the token and port handshake are transport-level, not API shape.

### Static export constraint

Detail routes are query-based so the Next.js `output: 'export'` build works with runtime UUIDs: `/jobs?id=<uuid>` and `/runs?id=<uuid>`. This is decided at F0; changing it later would be a refactor.

---

## 4. Final stack

| Layer | Choice | Notes |
| :--- | :--- | :--- |
| Frontend | **Next.js (App Router) + React 19 + TypeScript** | Static export (`output: 'export'`) loaded by Tauri; client components + TanStack Query against the local sidecar |
| Desktop shell | **Tauri 2 (Rust) + WebView2** | Native window, tray, updater, notifications, sidecar supervisor; NSIS per-user installer |
| Styling | **Tailwind CSS + shadcn/ui + lucide-react** | Dark-first; tokens in `FRONTEND_DASHBOARD_DESIGN.md` §4 |
| Client data | **TanStack Query v5** | Server-state caching, optimistic triage actions only |
| Client state | **Zustand** | `liveRunStore`, `toastStore`, `wsStatus` |
| Charts / PDF | **Recharts** · **react-pdf (pdf.js)** | Both client-only; `next/dynamic` with `ssr: false` |
| Backend | **Python 3.12 + FastAPI** | API + WebSocket + schedulers in one process |
| Database | **SQLite (WAL) + SQLAlchemy 2.0 + Alembic** | 15 tables after v2.1 additions (§7) |
| Automation | **Playwright persistent headed context on a dedicated Chrome-for-Testing profile** | Visible window; user logs in once per platform |
| Resume | **Typst (`typst-py`)** + `pypdf` round-trip test | Single column; verified, not asserted |
| LLM | **LiteLLM** (frontier + Ollama fallback) | Cheap-first routing + monthly budget guard |
| Embeddings | **fastembed (MiniLM) + sqlite-vec** | Local, zero cost |

---

## 5. Repository layout

```
JobSeeker/
├── ARCHITECTURE_PLAN.md
├── docs/
│   ├── FINAL_EXECUTION_PLAN.md          ← this file (authoritative)
│   ├── STATUS.md                        ← living two-agent status board
│   ├── BACKEND_IMPLEMENTATION_SPEC.md
│   ├── FRONTEND_DASHBOARD_DESIGN.md
│   ├── DESKTOP_PACKAGING_SPEC.md        ← Tauri 2 shell, installer, updater, CI
│   ├── JOB_DISCOVERY_ENGINE_DESIGN.md
│   ├── ATS_MATCHING_AND_TAILORING_SPEC.md
│   ├── form_automation_engine_design.md
│   ├── SAFETY_AND_RISK_AUDIT_REPORT.md
│   ├── PLAN_REVIEW.md                   ← historical record, do not edit
│   ├── contract/                        ← OpenAPI snapshots + example payloads (lead)
│   └── reviews/                         ← milestone gate reviews (lead)
├── backend/                             ← Gemini Antigravity (includes packaging/)
├── frontend/                            ← OpenCode (Next.js, static export)
├── desktop/                             ← OpenCode (Tauri 2 shell: src-tauri, icons)
├── scripts/                             ← dev/package/release scripts (lead)
├── core/                                ← frozen reference only, not imported
└── data/                                ← runtime, gitignored
```

**Week-0 setup:** `git init`, `.gitignore` (`data/`, `.env`, `node_modules/`, `.next/`, `out/`, `target/`, `__pycache__/`, `*.db`, `desktop/src-tauri/binaries/*.exe`), all three scaffolds (backend, frontend, desktop), first contract snapshot.

---

## 6. The contract (frozen)

Full detail lives in `docs/BACKEND_IMPLEMENTATION_SPEC.md` §7–8. Summary:

### REST (`/api/v1`)

| Group | Endpoints |
| :--- | :--- |
| Health | `GET /health` |
| Profile | `GET/POST /profile`, `POST /profile/import-resume`, `POST /profile/import-resume/confirm`, `GET/POST /profile/qa` |
| Jobs | `GET /jobs`, `POST /jobs/crawl`, `GET /jobs/{id}`, `POST /jobs/{id}/action`, `GET /jobs/sources`, `POST /jobs/sources`, `DELETE /jobs/sources/{company}` |
| Artifacts | `POST /matcher/tailor/{job_id}`, `GET /matcher/resume/{job_id}`, `GET /matcher/cover-letter/{job_id}` |
| Applications | `GET /applications`, `GET /applications/{id}`, `GET /applications/{id}/screenshot`, `POST /applications/start/{job_id}`, `POST /applications/approve/{id}`, `POST /applications/abort/{id}` |
| Browser | `GET /browser/status`, `POST /browser/launch`, `POST /browser/close` |
| Settings | `GET/POST /settings`, `POST /settings/platform-optin`, `POST /settings/llm-key` |

### WebSocket (`/ws/telemetry`)

`APPLICATION_STAGE_CHANGED`, `HITL_REVIEW_REQUIRED`, `CAPTCHA_CHALLENGE_DETECTED`, `RATE_LIMIT_UPDATE`, `SWEEP_COMPLETED`. Server push only; client may send `PING` / `RESYNC`; ring buffer holds the last 50 events.

### Enums

- **Job:** `discovered | filtered_out | score_queued | scored | skipped | tailoring | ready_to_apply | applying | applied | failed | archived`
- **Application:** `QUEUED | STARTING | AUTOFILLING | PAUSED_FOR_REVIEW | SUBMITTED | FAILED | BLOCKED | CAPTCHA_BLOCKED | DISCARDED`
- **Q&A provenance:** `DETERMINISTIC | LLM_GENERATED | USER_OVERRIDE` (+ `UNRESOLVED` as a blocking state)

### Desktop transport (not part of the public contract)

- The sidecar binds `127.0.0.1:0`; the shell learns the real port from the stdout handshake.
- Every `/api/v1/*`, `/ws/*`, and `/internal/*` request requires the per-launch bearer token.
- `POST /internal/shutdown` is the only internal endpoint (graceful stop).
- CORS origins: `http://tauri.localhost`, `https://tauri.localhost`, `tauri://localhost`, plus the dev origins (`http://localhost:3000`, `http://127.0.0.1:3000`).
- `Host` must be `127.0.0.1:<port>` or `localhost:<port>` (blocks DNS rebinding).
- WebSocket auth: `?token=<token>`; the token is never logged.

### Contract governance

1. `CONTRACT_VERSION = "1"`. Additive changes (new optional field, new endpoint) do **not** bump it.
2. Every change is recorded in the log below **before** merge, with frontend impact.
3. Removing/renaming a field or changing a type is breaking → bump to `"2"`, agree a same-day cutover, update both sides.
4. At the end of every backend milestone, Gemini exports `GET /openapi.json` to `docs/contract/openapi-M{n}.json` plus one example payload per endpoint. OpenCode regenerates TS types from it.
5. Responses are typed Pydantic models — no bare dicts, no `Any` payloads.

| Date | Version | Change | Frontend impact |
| :--- | :--- | :--- | :--- |
| 2026-11-11 | 1 | Baseline frozen contract | Initial typed client |

---

## 7. Data model additions (schema v2.1)

The v2 DDL was missing entities the rest of the plan depends on. These are now part of `ARCHITECTURE_PLAN.md` §5:

| Addition | Why |
| :--- | :--- |
| `education` | Matcher profile model has education; DDL did not |
| `projects` | Bullets reference `project_id`; no target table existed |
| `certifications` | Profile model has certifications; no table existed |
| `resume_import_drafts` | `POST /profile/import-resume` returns a `draft_id`; drafts need durable storage and never touch master tables until confirm |
| `jobs.company_logo_url` | `JobListItem` exposes it; no column existed |
| `tailored_resumes.cover_letter_tone` | Three tones are supported; store which one was used |
| `experience_bullets.project_id` → FK to `projects(id)` | Referential integrity |

**Draft rule:** imported data lives only in `resume_import_drafts.parsed_json` with `status = DRAFT`. `POST /profile/import-resume/confirm` copies accepted items into master tables with `verified = 1`. A draft is never readable by the matcher.

**`core/models/job.py`:** frozen historical reference. It is **not imported** by the backend. The canonical contract lives in `backend/app/schemas/job.py`; a parity test asserts the same field names so the docs cannot drift silently.

---

## 8. Build sequence and gates (core 8 weeks + desktop 3 weeks)

Three tracks run in parallel: backend (M1–M6), frontend (F0–F4), and desktop shell (D0–D3). Backend milestones are defined in `BACKEND_IMPLEMENTATION_SPEC.md` §14; frontend milestones in `FRONTEND_DASHBOARD_DESIGN.md` §6; desktop milestones in `DESKTOP_PACKAGING_SPEC.md` §16.

| Week | Backend (Gemini Antigravity) | Frontend (OpenCode) | Gate |
| :--- | :--- | :--- | :--- |
| **0** (2 days) | Repo skeleton, pyproject, config, DB + PRAGMAs, error envelope, `/health`, first migration | Next.js scaffold, tokens, app shell, API client + WS client, MSW fixtures, route stubs | Both boot; dashboard renders `/health`; `openapi-M0.json` committed |
| **1** | M1: settings, profile CRUD + import draft/confirm, Greenhouse + Lever, pipeline, `/jobs`, `SWEEP_COMPLETED` | F0 finish + F1: onboarding wizard, Job Inbox, Job Detail (JD + requirements), dashboard v1 | — |
| **2** | M1 finish + M2 start: matcher worker, extraction, gates, composite score, `/jobs/{id}` breakdown | F1 finish; F2 start: score-breakdown tab, filters, keyboard triage | **G1 — private job feed:** crawl → score → inbox with breakdown, real data |
| **3** | M2 finish + M3: tailor, fact-diff, Typst, round-trip, cover letter, artifact routes | F2: PDF preview + master/tailored diff, Profile + QA editors, Applications history v1 | — |
| **4** | M3 finish + M4: runtime manager, humanize, Greenhouse + Lever adapters, Q&A engine, caps/cooldown, application routes, mock-ATS E2E | F3: Review Queue (provenance badges), Run Monitor, WS live strip + toasts, Settings automation, Browser screen | **G2 — v1 shippable:** approve → PDF → visible browser fills mock ATS → human submit → audit |
| **5** | M4 finish + M5 start: LinkedIn opt-in gate + Easy Apply, Ashby adapter | F3 finish; F4 start: risk opt-in UI, autonomous gating UI | — |
| **6** | M5 finish: autonomous mode, generic fallback, CAPTCHA freeze/AFK, full adapter fixtures | F4: Applications analytics + CSV, empty/loading/error states, a11y pass | **G3 — feature complete:** every screen live, every lane gated |
| **7** | M6: stats, CSV, Workday (optional), polish, README | F4 finish: Playwright E2E per screen, performance, final polish | — |
| **8** | Full pytest green, live Assisted smoke on one real Greenhouse posting | Full E2E green, contract snapshot final, release checklist | **G4 — core release (web build)** |

### Phase D — desktop packaging (parallel; GA after core)

| When | Desktop track (OpenCode + Gemini sidecar work) | Gate |
| :--- | :--- | :--- |
| **Week 0–1** | **D0:** Tauri app boots, static export loads, stub sidecar handshake, `get_bootstrap`, window state | Shell ↔ sidecar integration proven early |
| **Week 5–6** | **D1:** real PyInstaller sidecar, token auth, port 0, supervisor, logs, single instance, tray, notifications, dialogs | Packaged app completes an Assisted run on the mock ATS |
| **Week 7–8** | **D2:** NSIS installer, updater + signing keys, CI pipeline, migration/backup, Chrome first-run, uninstall flow | Signed installer + updater manifest produced by CI |
| **Week 9** | **D3:** QA matrix, crash recovery, offline, a11y, performance, diagnostics, About, release candidate | **G5 — desktop GA:** QA matrix green on a clean Windows VM |

**Non-negotiable gate rule:** a milestone is not "done" until the integration lead's review in §9 passes. Backend announces completion; the lead verifies; then it is marked done in `docs/STATUS.md`. Desktop GA additionally requires the full QA matrix in `DESKTOP_PACKAGING_SPEC.md` §15.

---

## 9. Collaboration protocol

### 9.1 Daily async update (in `docs/STATUS.md`)

```markdown
### Backend — YYYY-MM-DD
Done: ...
Next: ...
Blocked: ...
Contract changes: none | (endpoint, field, impact)
Live endpoints: ...
Tests: x passed / y failed

### Frontend — YYYY-MM-DD
Done: ...
Next: ...
Blocked: ... (endpoint + example payload needed)
Screens against live API: n/11
Build: static export green? (out/ present)

### Desktop — YYYY-MM-DD
Done: ...
Next: ...
Blocked: ... (shell / sidecar / installer)
Handshake: ok | failing (detail)
Installer build: green | red
```

### 9.2 Weekly rhythm

| When | What |
| :--- | :--- |
| Monday | Lead posts the week's integration target and any contract needs |
| Daily | Both post the async update above |
| Wednesday | Contract checkpoint: any new fields? Any breaking drift? |
| **Friday** | **Integration day:** run both processes, execute the smoke script, run E2E, fix integration bugs, tag the milestone |
| End of milestone | Lead writes `docs/reviews/M{n}-review.md` with verdict `PASS` / `PASS-WITH-FIXES` / `BLOCK` |

### 9.3 What the integration lead (me) does to monitor the backend

I do not read code passively. For every backend milestone I run the same gate:

1. **Boot:** `uvicorn app.main:app` from a clean environment; `GET /health` matches §7.0 exactly.
2. **Schema:** `alembic upgrade head` on an empty DB; compare against the DDL; verify PRAGMAs applied at connection, not in migrations.
3. **Tests:** full `pytest`; coverage ≥90% on crawler/matcher/qa; the 12 fact-check mutation cases must fail loudly; concurrent cap test must allow exactly one start.
4. **Golden Rules audit:** no `datetime.utcnow`, no plaintext secrets, no `print` (logging only), no bare dict responses, no `frontend/` edits, error envelope on every non-2xx.
5. **Contract diff:** regenerate OpenAPI; diff against the previous snapshot; only additive changes allowed.
6. **Security:** binds `127.0.0.1`; keys in OS keyring; `.env` not committed; screenshots stay local; LinkedIn gate enforced server-side (not just hidden in UI).
7. **Smoke script:** crawl 2 companies → jobs appear; import → confirm → verified bullets; tailor → PDF passes round-trip; mock-ATS Assisted run → audit rows + screenshot.
8. **UI contract reality:** every field the frontend consumes is present with the documented type; check `score_breakdown` in degraded mode, `tailored: null` cases, pagination shape, and WS event field names.
9. **Desktop gate (D milestones):** NSIS installer runs on a clean VM; sidecar handshake succeeds; the API rejects requests without the token; a spoofed `Host` header is rejected; shutdown is graceful; the updater rejects an unsigned manifest.

Findings are filed with severity (`P0` blocks the gate, `P1` fix this milestone, `P2` backlog), a repro command, expected vs actual, and the endpoint/payload involved.

### 9.4 What the lead provides to the backend

- Example request/response payloads for every endpoint before implementation.
- UI-driven requirements ("Job Detail needs `components` even when degraded").
- Prioritization: what blocks the frontend this week vs. what can wait.
- Bug reports (template below) and review verdicts.
- Contract decisions when the docs are ambiguous.

### 9.5 Bug report template

```markdown
### [P1] GET /jobs/{id} returns bare dict for score_breakdown
Repro: curl -s localhost:8000/api/v1/jobs/<id> | jq .score_breakdown
Expected: object with final, hard_gate, components, matched_skills, missing_skills, degraded
Actual: {"final": 87.5}
Impact: Job Detail score tab crashes on components.*
Contract: §7.2
```

### 9.6 Blocking rules

- **Backend behind?** Frontend uses MSW handlers generated from contract examples. Never invent an endpoint. Acceptance still requires the live API.
- **Frontend behind?** Backend keeps shipping; it never adds server-rendered HTML or UI workarounds.
- **Disagreement?** Precedence: this document's Decisions Log → `BACKEND_IMPLEMENTATION_SPEC.md` → `ARCHITECTURE_PLAN.md` → component sub-specs.
- **Schema change?** Lead updates the DDL + docs first, then backend migrates, then frontend regenerates types. Never the other order.

### 9.7 Definition of done (whole product)

- `pytest` green, `npm run build` green, `npm run e2e` green.
- Boot → onboarding → crawl → score → tailor → assisted apply on the mock ATS → audit, with zero manual DB edits.
- Every screen renders real API data; zero mocked fields at acceptance.
- One live Assisted smoke on a real Greenhouse posting, reviewed and documented.
- Desktop: signed NSIS installer on a clean Windows VM; sidecar handshake + token auth verified; upgrade preserves data with a pre-migration backup; uninstall offers keep/delete; updater verifies signatures.
- `docs/STATUS.md` shows all milestones done; `docs/contract/openapi-M6.json` is the final contract.

---

## 10. Decisions log (resolves the remaining doc conflicts)

| # | Decision | Rationale |
| :--- | :--- | :--- |
| D1 | Frontend is **Next.js App Router**, built as a **static export** and loaded by the Tauri shell; detail routes are query-based (`/jobs?id=`, `/runs?id=`) | Runtime UUID paths cannot be statically generated; query routes keep the App Router intact with no Node server at runtime |
| D1a | Frontend runs as its own dev process (`next dev` on `:3000`) in development only | Keeps hot reload; not part of the shipped runtime |
| D2 | `frontend/` = OpenCode, `backend/` = Gemini; `docs/` + `scripts/` = lead | Clean directory ownership; no merge conflicts |
| D3 | Add `education`, `projects`, `certifications`, `resume_import_drafts`; add `jobs.company_logo_url`; add `tailored_resumes.cover_letter_tone`; FK `experience_bullets.project_id` | Schema now matches the profile model and the API |
| D4 | `core/models/job.py` is frozen reference, not imported; `backend/app/schemas/job.py` is canonical | Avoids a shared package with two owners; parity test prevents drift |
| D5 | **Selection-only tailoring wins.** "Factual rephrasing" and synthesized summaries are removed from the matcher spec | A rewritten bullet is a new claim; verbatim bullets are auditable |
| D6 | Frontend uses `/profile/import-resume` (+ `/confirm`) and `/browser/status` | Matches the frozen contract; the old frontend doc names were stale |
| D7 | Canonical application enum only; `IN_PROGRESS` is not a status | One vocabulary across DB, API, WS, and UI |
| D8 | No stealth patching, no WebGL spoofing, no proxy pools | v2 philosophy: real visible browser + human pace; also required by backend non-goals |
| D9 | Structured `salary` is serialized from `jobs.salary_info`; tailored file paths are derived from `tailored_resumes` | No duplicate columns |
| D10 | Import drafts live in `resume_import_drafts` and never reach master tables before confirm | Prevents unverified claims from being scored or tailored |
| D11 | Cover-letter tone is stored per artifact, default `technical_direct` | Auditability |
| D12 | CORS allowlist: desktop origins (`tauri://localhost`, `http://tauri.localhost`, `https://tauri.localhost`) + dev origins (`localhost:3000`, `127.0.0.1:3000`); WS connects directly to the sidecar port | Desktop + dev; no WS proxy through Next.js |
| D13 | Services bind `127.0.0.1` only; launchers/build scripts in `scripts/` | Local-only security posture |
| D14 | Dev-only MSW fixtures are allowed; acceptance requires the live API | Parallel development without contract invention |
| D15 | Core schedule is 8 weeks; desktop GA is Week 9 (Week 10 if certificate procurement is slow) | Preserves MVP-first; packaging runs in parallel, not as a rewrite |
| D16 | **Desktop app = Tauri 2 shell + WebView2**, not Electron and not a browser-only launcher | Smallest production-grade shell; native tray/updater/notifications; no duplicated Chromium |
| D17 | Next.js builds with `output: 'export'`; detail routes are query-based (`/jobs?id=`, `/runs?id=`) | Static export cannot build runtime UUID paths; decided at F0 to avoid a refactor |
| D18 | Sidecar binds `127.0.0.1:0`; per-launch bearer token; strict `Host` check | OS-assigned port avoids conflicts; token + Host check stop other local processes and DNS rebinding |
| D19 | Sidecar is a PyInstaller **one-folder console** build; handshake on stdout | Windowed builds break stdout; one-folder is faster and friendlier to antivirus |
| D20 | App data lives in `%APPDATA%\JobSeeker`; pre-migration backup; uninstall keeps data by default | PII safety; recoverable upgrades; no accidental deletion |
| D21 | Chrome: installed Chrome first, pinned checksum-verified Chrome-for-Testing download as fallback | Small installer, real browser, deterministic fallback |
| D22 | Updates use the Tauri updater with minisign signatures and GitHub Releases; **no telemetry** | Free, signed, verifiable; privacy preserved |
| D23 | Authenticode-sign installer and binaries; unsigned builds are an internal channel only | SmartScreen trust; production quality |
| D24 | CI on GitHub Actions `windows-latest` builds sidecar + UI + installer, signs, and publishes checksums | Reproducible releases without a paid pipeline |
| D25 | The shell owns window/lifecycle; the sidecar owns all business logic; the backend never renders UI | Clean boundary; keeps the frozen API and ownership split intact |
| D26 | Desktop capabilities are least-privilege; CSP locks `connect-src` to localhost; devtools off in release | A desktop shell is a security boundary, not just a wrapper |

---

## 11. Risks (unchanged in substance)

| Risk | Mitigation |
| :--- | :--- |
| LinkedIn account restriction | Opt-in typed acknowledgment, ≤25/day, cooldowns, dedicated profile; never labeled compliant |
| Aggregator breakage | Tier-1 ATS carries discovery; jobspy pinned + circuit-broken |
| Selector rot on ATS forms | Recorded fixtures + weekly refresh; adapters pause loudly instead of mis-filling |
| LLM hallucination | Selection-only tailoring, immutable metrics, deterministic fact-diff, baseline fallback |
| CAPTCHA | Zero bypass; freeze, notify, 5-min AFK timeout, platform pause |
| Cost overrun | Cheap-first routing + monthly budget guard + visible degradation |
| Two-agent drift | Frozen contract, snapshots, Friday integration, ownership boundaries |
| Chrome platform changes | Pinned Chrome-for-Testing; documented fallback if persistent contexts are restricted |
| PyInstaller + Playwright packaging | D0/D1 spike on a clean VM; one-folder mode; system Chrome first |
| Sidecar lifecycle bugs (port, token, orphans) | Port 0, stdout handshake, supervisor, parent-PID watchdog, integration test in CI |
| SmartScreen / antivirus reputation | Authenticode signing, timestamping, checksums, no packers |
| Updater key loss or bad update | Offline key backup; signature verification; pre-update DB backup; manual rollback documented |
| Installer size | System Chrome first; CFT as a first-run download |

---

## 12. Day 1 — next actions

**Lead (me):**
1. `git init`, `.gitignore`, root `README.md`, `scripts/dev.ps1`.
2. Create the Next.js scaffold (static export), design tokens, app shell, typed API client, WS client, MSW fixtures.
3. Create the Tauri 2 scaffold in `desktop/` with a **stub sidecar** that prints the handshake, plus `get_bootstrap`, splash, and window state. This de-risks the hardest integration on day one.
4. Publish `docs/contract/openapi-M0.json` skeleton + example payloads.
5. Seed `docs/STATUS.md`.

**Gemini Antigravity:**
1. Create `backend/` exactly per `BACKEND_IMPLEMENTATION_SPEC.md` §4, including `app/runtime/` (token middleware, handshake, shutdown) and `packaging/` (PyInstaller spec + entrypoint).
2. Boot FastAPI with config, DB (WAL + FK pragmas), error envelope, `/health`, token middleware, port-0 handshake, first Alembic migration including the v2.1 tables.
3. Produce the first `autojob-core.exe` sidecar build so the shell team can swap the stub for the real binary.
4. Post the first daily status with the live `/health` URL and the handshake output.
5. Do not touch `frontend/`, `desktop/`, or `docs/`.

**Gate 0:** Tauri window opens with the Next.js UI; the real sidecar handshake works; the dashboard shows healthy with token auth; the first contract snapshot is committed.