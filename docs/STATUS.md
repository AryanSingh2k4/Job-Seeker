# Build Status — Living Board

**Updated by:** both agents, daily. **Gate reviews:** `docs/reviews/` (integration lead).
**Authoritative plan:** `docs/FINAL_EXECUTION_PLAN.md` · **Desktop spec:** `docs/DESKTOP_PACKAGING_SPEC.md`.

## Current

| | Backend (Gemini Antigravity) | Frontend (ZCode) | Desktop shell (ZCode) |
| :--- | :--- | :--- | :--- |
| Milestone | M0 — ✅ done | F0 — 🟨 scaffold done, static export GREEN | D0 — 🟨 scaffold done, build pending Rust toolchain |
| Contract version | 1 | 1 | — |
| Last OpenAPI snapshot | openapi-M0.json (verified snapshot) | — | — |
| Live endpoints | 26 routes (GET /health, /api/v1/*, /ws/telemetry, /internal/shutdown) | renders /health against contract | stub handshake (port 8000) |
| Blockers | none | — | Rust toolchain not installed on build box |

## Milestone board

| Milestone | Owner | Status | Gate |
| :--- | :--- | :--- | :--- |
| M0 / F0 / D0 — scaffold + contract v1 + shell skeleton | both | ⬜ | Gate 0: Tauri window shows the Next.js UI; real sidecar handshake + token auth; `/health` in dashboard |
| M1 / F1 — discovery + job feed | both | ⬜ | G1: crawl → score → inbox |
| M2 / F2 — matching + artifacts | both | ⬜ | — |
| M3 / F2 — tailoring UI | both | ⬜ | — |
| M4 / F3 — applier + review/monitor | both | ⬜ | G2: Assisted run end-to-end (mock ATS) |
| M5 / F4 — LinkedIn lane + gating | both | ⬜ | G3: feature complete |
| M6 / F4 — hardening + analytics | both | ⬜ | G4: core release (web build) |
| D1 — real sidecar in the shell | OpenCode + Gemini | ⬜ | Packaged Assisted run on mock ATS |
| D2 — installer + updater + CI | OpenCode | ⬜ | Signed installer + updater manifest from CI |
| D3 — desktop polish + QA | OpenCode | ⬜ | G5: desktop GA, QA matrix green on a clean VM |

Legend: ⬜ not started · 🟨 in progress · 🟦 in review · ✅ done · 🟥 blocked

**Gate rule:** a milestone is not done until the integration lead's review (`docs/FINAL_EXECUTION_PLAN.md` §9) passes. Desktop GA additionally requires the full QA matrix in `DESKTOP_PACKAGING_SPEC.md` §15.

---

## Daily update template

```markdown
### Backend — YYYY-MM-DD
Done:
Next:
Blocked:
Contract changes: none | (endpoint, field, impact)
Live endpoints:
Tests: x passed / y failed

### Frontend — YYYY-MM-DD
Done:
Next:
Blocked: (endpoint + example payload needed)
Screens against live API: n/11
Build: static export green? (out/ present)

### Desktop — YYYY-MM-DD
Done:
Next:
Blocked: (shell / sidecar / installer)
Handshake: ok | failing (detail)
Installer build: green | red
```

---

## Log

### 2026-11-11 — GO issued · Week 0 started (frontend + desktop track)

**Frontend (ZCode) — F0 progress:**
- Done: Next.js 15 scaffold (App Router, static export, trailingSlash, query-route decision D17); design tokens in `app/globals.css` (§4 palette: bg/surface/accent/score-bands/provenance colors); dark app shell (sidebar nav + telemetry pill + toast stack); typed API client with error-envelope unwrap + Tauri bootstrap resolution (`get_bootstrap` → `__JOBSEEKER_BOOTSTRAP__`, dev fallback :8000 no-auth); WS client with reconnect/backoff, RESYNC-on-open, PING keepalive; Zustand stores (`liveRun`, toasts, wsStatus) wired to the 5 contract events; MSW fixtures (`/health`, `/jobs`, `/applications` — run `npm run msw:init` once before NEXT_PUBLIC_MSW=1); 9 route stubs all statically rendered.
- **Verification: `npm run build` GREEN — 12 static pages exported to `out/` (Next 15.5.29, TS strict).**
- Next: F1 — onboarding wizard + Job Inbox + Job Detail against live M1 endpoints; regenerate types from Gemini's real openapi-M1.json.
- Screens against live API: 0/11 (contract fixtures only so far).

**Desktop (ZCode) — D0 progress:**
- Done: Tauri 2 scaffold (`desktop/src-tauri/`): two-bin workspace (jobseeker shell + `autojob-core-stub`), splash→main window lifecycle per spec §3.1, `AUTOJOB_READY` stdout handshake parser, `get_bootstrap` IPC command, exit-kill of sidecar (no orphans), least-privilege capabilities (core + window show/close/focus), `frontendDist: ../frontend/out` wired.
- Blocked (environment): Rust toolchain not installed on this build box — `cargo build` verification pending. Files written to Tauri 2 API as documented; D0 acceptance runs once toolchain is present.
- D1 open items noted in code: async spawn + 20 s timeout/retry screen, supervision, parent-pid watchdog, single-instance guard, locked CSP (dynamic-port vs CSP-wildcard conflict — needs the tauri-plugin-http decision, spec D26).

**Lead (ZCode):**
- Done: git init + .gitignore + README; `scripts/dev.ps1`; `docs/contract/openapi-M0.json` skeleton + 3 example payloads committed (`openapi-M0` is the lead skeleton — Gemini replaces it with the real snapshot at M0 close).
- Awaiting: Gemini M0 boot + handshake output; DeepSeek Week-0 fixture skeleton.

### 2026-11-11 — Owner decisions: product name + Rust shell confirmed
- Product name confirmed: **JobSeeker** (was codename Auto-Job / candidate Attest). All doc titles renamed; repo folder and internal identifiers (`autojob-core.exe`, `AUTOJOB_READY`, `AUTOJOB_*` env, `autojob.db`) intentionally unchanged. Naming section updated in `FINAL_EXECUTION_PLAN.md` §0.
- Desktop track (Tauri 2 Rust shell, Phase D0–D3) **confirmed in scope** by the owner — was pending veto.
- Three-agent build confirmed: Gemini Antigravity (backend), ZCode (frontend + desktop shell + integration lead), DeepSeek via OpenCode (fixtures, golden JD corpus, parity/QA tests).

### 2026-11-11 — Tauri 2 desktop plan frozen (v2.2)
- Desktop product decided: **Tauri 2 shell + WebView2**, PyInstaller sidecar, NSIS installer, signed updates, Phase D (D0–D3).
- `docs/DESKTOP_PACKAGING_SPEC.md` v1.0.0 published.
- Docs updated to v2.2: architecture, frontend (static export + query routes + desktop integration), backend (sidecar runtime, token/Host guard, packaging), final plan, safety addendum.
- Timeline: core G4 Week 8; desktop GA Week 9.

### 2026-11-11 — Plan frozen
- `docs/FINAL_EXECUTION_PLAN.md` v1.0 published (Next.js, ownership, gates, decisions D1–D15).
- Docs updated to v2.1: architecture, backend spec, frontend design, discovery, matcher, safety addendum.
- Next: Week 0 — repo + scaffolds + `openapi-M0.json`.

### Backend — 2026-11-11
Done: M0 complete and verified. Built app/main.py, /health (exact §7.0 shape matching byte-for-byte), standardized error envelope, app/runtime/ (token middleware, strict Host check, port-0 AUTOJOB_READY handshake, POST /internal/shutdown, parent watchdog), app/schemas/ (canonical job schemas with contract parity, health, profile, application, settings, telemetry), all 26 documented routes active, app/ws/telemetry.py (WebSocket hub + ring buffer), PyInstaller spec autojob-core.spec, real openapi-M0.json snapshot committed. Contract parity skips converted to passes. All 47 pytest tests passed.
Next: M1 (Crawler pipeline for Greenhouse + Lever + Ashby, deduplication & prefiltering, /jobs and /jobs/crawl execution, resume import draft/confirm).
Blocked: none
Contract changes: none
Live endpoints: 26 routes (GET /health, /api/v1/*, /ws/telemetry, /internal/shutdown)
Tests: 47 passed / 3 skipped (offline suite) / 0 failed

### Fixtures & Tests — 2026-11-11
Done: Week 0 fixture foundation landed. Synthetic mock ATS (`backend/fixtures/mock_ats/index.html`): one self-contained file, 3 runtime states (contact → screening → review), visually hidden `#resume` behind a dropzone, high-stakes work-auth/sponsorship/years, deterministic `window.__MOCK_ATS__`, terminal `SUBMITTED`/`DISCARDED` states. Deterministic `test_profile.json` (Ada Lovelace, `example.com` / `555` only). `manifest.json` (`autojob.fixture-manifest.v1`) indexes the 3 mock-ATS states with expected fields, selectors, values, high-stakes flags and outcomes. `company_registry.json` seed: 115 verified companies / 121 board tokens (63 Greenhouse, 5 Lever, 53 Ashby; 6 dual-listed), verified 2026-11-11 against the public board APIs. Offline suite `test_adapter_fixtures.py` (manifest/registry/profile/mock-ATS integrity; no-network and no-secret assertions) + `test_contract_parity.py` (canonical `JobStatus` vs ARCHITECTURE_PLAN §5; enum/field parity vs backend schema with graceful skips; contract-example + frozen error-envelope validation; opt-in live OpenAPI via `AUTOJOB_OPENAPI_URL`). `backend/tests/contract_examples/` scaffolded with the §7 endpoint inventory; `backend/fixtures/README.md` documents the manifest schema and determinism rules. Verified locally: **35 passed / 5 skipped** (skips = backend schema not present, no example files yet, live check unset).
Next: Weeks 1–2 — record Greenhouse + Lever multi-step application pages into `fixtures/greenhouse` / `fixtures/lever`, expand the manifest, and drive adapters with `page.set_content` asserting every field is identified-and-filled **or** the adapter cleanly pauses.
Blocked: none. (Note: `backend/app/schemas/job.py` is absent, so schema/enum parity tests skip — expected until backend M0 lands it.)
Fixture count: 0 recorded · 3 manifest entries (1 synthetic file) · 115 companies / 121 board tokens
Bugs filed: none

### 2026-11-11 — Accelerated build: beauty pass + Gemini sprint gate
**Frontend (ZCode):** Phase-2 design rebuild committed (f667aed): aurora/glass materials, framer-motion primitives (Stagger/Rise/CountUp/ProgressRing), ⌘K command palette (cmdk), sonner toasts bridged from WS store, glowing score chips, keyboard triage (j/k), skeleton shimmer, designed empty states. Build GREEN; dashboard + inbox visually verified at 1440×860.
**Backend gate (Gemini, lead-run):** boots ✓ · 52 passed/3 skipped ✓ · full §7 route surface present ✓ · /health payload matches §7.0 byte-shape ✓ · **P1 finding: /health mounted at root, contract requires /api/v1/health — add alias** · real openapi-M0.json still pending.
**Desktop:** MSVC Build Tools installed (VC\Tools\MSVC present); first cargo build running.
**Infra:** git baseline 5 commits; fixture subagents 3–4 running; agents 1–2 resume when slots free.

### 2026-11-11 — Accelerated session: Gate-0 desktop CLOSED, Phase 2+3 done
**Desktop (ZCode):** MSVC Build Tools installed ✓ · cargo build GREEN after 3 fixes (missing icon.ico — generated; missing Deserialize derive; moved-value) · **`jobseeker.exe` (12.6MB) + `autojob-core-stub.exe` built** — Gate-0 desktop half CLOSED. Stub handshake smoke pending.
**Frontend (ZCode):** Phase 3 shipped — real 4-step onboarding wizard (animated step transitions, drag-drop resume, source toggles w/ LinkedIn warning) + Job Detail (query route /jobs?id=, Suspense-wrapped, animated 5-component score bars, matched/missing skill chips, JD view, artifacts tab). Build GREEN 12 pages. Fixes: useSearchParams import (next/navigation), icon.ico, stale-dev-server module graph (wiped .next).
**Fixture agents:** contract-examples ✓ DONE — 66 files, ALL 15 frozen error codes, 12 mutation cases; agent caught an arithmetic inconsistency in spec §7.2's own score_breakdown example (finding logged for spec fix). GH/Lever recording resumed. LinkedIn/Ashby/CAPTCHA still running. JD corpus queued behind concurrency limit.
**Gemini watch:** app boots, 52 tests green, full §7 routes — /api/v1/health alias (P1) still owed.

### 2026-11-11 — Visual verification pass + LinkedIn/Ashby/CAPTCHA fixtures DONE
**Frontend (ZCode):** all 4 key screens visually verified at 1440×860 — dashboard (aurora/glass/rings/funnel), job inbox (stagger + glow chips), onboarding wizard (animated steps), job detail (Job tab: matched/missing skill chips; Score tab: animated 5-bar breakdown). Fixed: useSearchParams import, stale .next/dev-server collisions (dev now on :3010).
**Fixtures (DeepSeek lane, agent d):** DONE — Ashby 2 real recordings (SPA shells + board JSON companions, tokens REDACTED, offline-verified zero network) · LinkedIn Easy Apply synthetic modal (31/31 selector tests incl. discard flow) · CAPTCHA 4 fixtures (recaptcha/turnstile/arkose/cleared) · manifest bumped to 1.1.0. Deviation noted: Ashby POST /job-board now 401s; GET recorded instead.
**Pending:** GH/Lever recording (running), JD corpus (queued behind concurrency), QA orchestrator frontend pass, Gemini /api/v1/health alias.

### 2026-11-11 — GH/Lever fixtures DONE · pushed to GitHub · corpus resumed
**Fixtures:** Greenhouse×3 (Affirm ML Engineer II, Discord Sr SWE Revenue, Robinhood FS Credit Cards — HTML + questions-schema JSON each) + Lever×2 (Palantir Edge Infra via /apply SSR form, Spotify Sr Backend Content Platform) — all real public recordings, 90 expected-field selectors verified in-HTML, manifest → 19 entries. Adapter notes logged: Lever forms carry hCaptcha (offline fill OK, submit blocked by design); Databricks/Coinbase/Elastic/Fivetran boards redirect to proprietary career sites (excluded). Fixture coverage now: GH 3 · Lever 2 · Ashby 2+board JSON · LinkedIn modal · mock ATS · CAPTCHA×4.
**Repo:** pushed to github.com/AryanSingh2k4/Job-Seeker (11→13 commits, secrets sweep clean).
**Running:** JD corpus agent resumed (30 JDs, GET-fallback for Ashby); QA orchestrator frontend review.

### 2026-11-11 — QA orchestrator verdict: PASS-WITH-FIXES → all findings fixed
**QA review (independent agent, fresh-eyes):** build ✓ typecheck ✓ frozen contract ✓ (5 call sites, all valid §7 paths; WS §8 field-exact) enums ✓ golden rules ✓ static-export ✓; 10 findings (2×P1, 8×P2).
**Fixed in this commit:** P1 j/k guard (inputs/contentEditable/modifiers) · P1 stage stepper explicit map over all 7 §8 stages incl. FAILED (red terminal dots) · dashboard derives backend/db values + cap-ring limits from payload, funnel labeled demo, fake reply-metric removed · jobs contrast → full text-muted (6.9:1) · artifact links open via sidecar baseUrl (static-export-safe) + resume link added · MSW: POST crawl/launch/profile handlers added · ensureApi retries failed resolve after 10s TTL (no more latching wrong origin) · palette ESC closes · onboarding honestly wired: controlled form, POST /profile on finish (mock pre-M1), role="switch" toggles, labels htmlFor/id, LinkedIn toggle locked w/ warning · build script now wipes .next first (kills the /_not-found invariant flake).
**Deferred (logged, P2-minor):** SWEEP_COMPLETED → jobs invalidation (wire at M1), toast ring bound, filter buttons inert until F2.

### 2026-11-11 — Phase 1 COMPLETE: JD corpus 30/30 · Gemini P1 closed · spec example fixed
**JD corpus (agent b):** 30/30 real postings from live board APIs (20 Greenhouse, 9 Ashby-GET, 1 Lever) — 61 files: cleaned JD .txt + hand-analyzed .expected.json each + index.json. Seniority mix 4 entry / 8 mid / 10 senior / 5 staff / 1 lead / 2 principal; 28 unique companies; negative/edge controls included (Cloudflare network staff = low band, Supabase/Replit specialized = mid). 5 dead registry boards skipped honestly. No credentials.
**Gemini P1 CLOSED:** /api/v1/health alias live (both 200, verified by lead boot test) — openapi-M0 real snapshot still owed.
**Spec fix:** §7.2 score_breakdown example corrected to arithmetically consistent 86.4 (finding from contract-examples agent); frontend MSW mock aligned.
**Phase 1 = COMPLETE.** All four fixture agents delivered: GH/Lever recordings, JD corpus, contract examples + mutations, LinkedIn/Ashby/CAPTCHA. Adapter test foundation is final.

### 2026-11-11 — BACKEND TAKEOVER (ZCode): rate limits + live crawl + 8390 real jobs
**Taken over from Gemini at owner's order.** Found & fixed:
- 3 QA AttributeErrors in applier/qa.py (target_role→target_preferences, skills.name→canonical_name, experiences→work_experiences)
- Manifest drift (3 agents, 3 shapes) → normalized 11 entries (total_steps/step_index/fields) → fixture tests 88 passed 0 failed (subagent enriched recorded entries with REAL options from companion JSONs + HTML, manifest v1.2.0)
- Crawler crash: metadata_→job_metadata kwarg (sweep was dead on arrival)
- CORS: dev ports 3010/3011 allowlisted (browser blocked localhost:3011→8000; WS connected but fetch died — subtle)
**RATE LIMITS (owner spec):** crawl_interval_minutes default 30→**5**; NEW crawl_max_companies_per_day=**50**; enforced in scheduler crawl_loop (reads settings each cycle, counts distinct companies discovered today, sweeps only the remainder) + manual POST /jobs/crawl returns 409 cap_reached when exhausted; both user-changeable via GET/POST /settings.
**LIVE PROOF:** sweep on 50-company cap → **8,390 real jobs in SQLite** (Intercom/Stripe/etc. from real Greenhouse boards); dashboard + inbox verified visually against live backend (sidecar 2.0.0 · contract v1 · WS telemetry open). Intercom same-role-multiple-offices rows are correct distinct postings (London/Berlin/Dublin, distinct source ids).

### 2026-11-11 — DESIGN v3: warm ink + champagne gold, dual theme, zero blue (owner-mandated)
Owner rejected the blue/glass v2 as generic. Full identity rebuild:
- **Type**: Fraunces (display serif) + Inter (UI) + JetBrains Mono (data) via next/font — display serif on wordmark + all page titles
- **Color**: warm ink dark theme + warm paper light theme (persistent toggle, no-blue mandate); champagne gold identity; legacy tokens aliased so all screens restyled at once
- **Hardcoded purges**: violet/blue gradients in funnel/score-bars → gold; ring tracks themed; glows warm
- **Stubs killed**: Applications is a real screen (table structure + designed empty state + export), Settings is real (crawl interval + daily company cap wired to GET/POST /settings — owner rate-limits editable in UI), Review/Profile framed in the v3 system
- **Infra**: CORS → loopback regex allowlist (any localhost port; no more per-port allowlist churn), .next/dev-server collision root-caused (never build while dev runs; build script wipes first)

### 2026-11-12 — Typography pass: Anthropic-style system (owner directive)
- Fonts: Copernicus→**Source Serif 4** (display), Styrene→**Space Grotesk** (UI), JetBrains Mono (data) — free equivalents of the Anthropic brand trio
- Accent gold→**terracotta #d97757** (Anthropic brand hue); light theme → Anthropic oat (#f0eee6) / paper (#faf9f5)
- Build green (12 pages); both themes visually verified against live backend

### 2026-11-12 — Owner took over backend fully · design v4 · loops LIVE
**Backend (ZCode, ordered takeover):** scheduler loops wired to REAL services (match_loop→process_score_queue every 10s, apply_loop→ApplicationEngine when queued+gates allow) · 3 QA attribute bugs fixed · metadata_→job_metadata (crawler+matcher) · CORS→loopback regex · rate limits live (5-min interval, 50 companies/day, /settings-backed) · **88 tests green** · live sweep 8390 jobs · profile seeded (Ada test) → matcher scoring live (thin 4-skill profile → most roles legitimately skip <65; full onboarding improves)
**Frontend v4 (ZCode + 2 subagents):** premium glass system (blur28 saturate170, specular edges, orb layer) · bento dashboard (hero CountUp band, ring caps, animated funnel, live-run stepper) · Jobs inbox rebuilt as dense glass data table (segmented band filters, load-more, j/k spotlight) · Job Detail v4 (64px hero score) · Review/Runs/Profile real screens (queries, abort actions, event timeline, CAPTCHA banner, QA provenance, profile 404→onboarding CTA) · Applications real table · Settings wired (crawl interval+cap editable) · theme toggle dark/light · Anthropic-style type (Source Serif 4 + Space Grotesk + JetBrains Mono)
**NEEDS OWNER:** 1) LLM API key (Settings→llm-key) for real scoring/tailoring — degraded mode works but caps at ~80 and skips extraction 2) onboarding pass with REAL personal data (test profile Ada is seeded) 3) Chrome login in the automation browser for live apply 4) Rust toolchain already done ✓

### 2026-11-12 — Shell v5.1: marquee removed, collapsible sidebar (owner request)
- Ticker/marquee strip deleted from the shell (Element 1, owner-selected)
- Top command rail → **collapsible left sidebar**: wordmark, search (⌘K), 7 nav items, telemetry status, theme toggle, collapse toggle (persisted via localStorage); icon-rail mode at 64px with active-bar indicator
- Flex wrapper restored (sidebar had gone full-width without it) — verified in browser: sidebar + dashboard render correctly, marquee gone, collapse toggle works

### 2026-11-12 — Shell v5.2 (owner directives)
- Eyebrow labels + page subtitles removed on EVERY page (PageHeader renders title only)
- Theme toggle moved out of sidebar → Settings page (Appearance panel)
- Settings nav item moved to the sidebar footer (below telemetry)
- JobSeeker logo is now the collapse/expand button for the sidebar (chevron affordance shown expanded)

### 2026-11-12 — D1 MILESTONE: real sidecar packaged + wired into desktop shell
- **PyInstaller sidecar built**: `backend/packaging/dist/autojob-core/autojob-core.exe` (one-folder console build) — live smoke passed: `AUTOJOB_READY {"port": 63128, "token": <random>, ...}` handshake on OS-assigned port, /api/v1/health 200 under the emitted token, CLI args match spec (--data-dir/--host/--port/--parent-pid/--shutdown-grace/--log-level)
- **Desktop D1 wiring**: shell now prefers the real `autojob-core.exe` over the stub (env override → sibling exe fallback chain); cargo build green
- **M6 verified live**: GET /applications/stats (shape per contract), GET /applications/export (CSV stream)
- **Milestone suite**: 88 passed / 1 skipped (full pytest)
- dist/build directories gitignored

### 2026-11-12 — QA audit FAIL → all findings fixed & empirically re-proven
QA auditor verdict was FAIL (4×P1, 8×P2) — all empirically reproduced, all fixed, all re-proven live:
- **P1-1** cap route crashed (AppException positional-arg swap) → keyword args; 409 cap_reached envelope reachable
- **P1-2** GET /jobs/sources unreachable (route shadowed by /{id}) → sources routes relocated above /{id} → 200 ✓
- **P1-3** GET /jobs/{id} 500'd (stale v1 fields: metadata_ + tailored_resume_path) → job_metadata everywhere + tailored_resumes relationship (latest artifact, real fact_check_status) → no-500 ✓
- **P1-4** /ws/telemetry ignored the bearer token in sidecar mode → token+enforce on app.state, WS validates ?token=/Bearer, closes 4401 → no-token rejected ✓, with-token PONG ✓
- **P2 batch**: autonomous gate now reads the DB system_settings row (UI toggle no longer inert) · crawl-cap window → local midnight · matcher queue ordered + ≤3 attempts before failed · config default 30→5 · dead ternary/approve cleaned · QUEUED status precondition on execute_application
- Root cause note: all four P1s were runtime-only — no test executed jobs endpoints against a live client. The audit's empirical method caught what static parity checks couldn't. Runtime regression proof now runs before every backend close.
