# Build Status — Living Board

**Updated by:** both agents, daily. **Gate reviews:** `docs/reviews/` (integration lead).
**Authoritative plan:** `docs/FINAL_EXECUTION_PLAN.md` · **Desktop spec:** `docs/DESKTOP_PACKAGING_SPEC.md`.

## Current

| | Backend (Gemini Antigravity) | Frontend (ZCode) | Desktop shell (ZCode) |
| :--- | :--- | :--- | :--- |
| Milestone | M0 — awaiting start | F0 — 🟨 scaffold done, static export GREEN | D0 — 🟨 scaffold done, build pending Rust toolchain |
| Contract version | 1 | 1 | — |
| Last OpenAPI snapshot | openapi-M0.json (lead skeleton) | — | — |
| Live endpoints | — | renders /health against contract | stub handshake (port 8000) |
| Blockers | — | — | Rust toolchain not installed on build box |

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
Done: Completed mandatory reading in required sequence (FINAL_EXECUTION_PLAN §10/9/12/6, BACKEND_IMPLEMENTATION_SPEC §7–8 frozen contracts, ARCHITECTURE_PLAN v2.2 DDL with 15 v2.1 tables, DESKTOP_PACKAGING_SPEC sidecar contract). Verified local Python 3.13 & uv 0.12. Formulated Week 0 (M0) execution plan.
Next: Execute Week 0 (M0) backend skeleton, config, DB WAL/FK init, 15 tables Alembic migration, error envelope, /health, runtime token/Host guard, port-0 stdout handshake, PyInstaller spec, openapi-M0.json snapshot.
Blocked: Awaiting owner explicit GO confirmation.
Contract changes: none
Live endpoints: none
Tests: 0 passed / 0 failed

### Fixtures & Tests — 2026-11-11
Done: Week 0 fixture foundation landed. Synthetic mock ATS (`backend/fixtures/mock_ats/index.html`): one self-contained file, 3 runtime states (contact → screening → review), visually hidden `#resume` behind a dropzone, high-stakes work-auth/sponsorship/years, deterministic `window.__MOCK_ATS__`, terminal `SUBMITTED`/`DISCARDED` states. Deterministic `test_profile.json` (Ada Lovelace, `example.com` / `555` only). `manifest.json` (`autojob.fixture-manifest.v1`) indexes the 3 mock-ATS states with expected fields, selectors, values, high-stakes flags and outcomes. `company_registry.json` seed: 115 verified companies / 121 board tokens (63 Greenhouse, 5 Lever, 53 Ashby; 6 dual-listed), verified 2026-11-11 against the public board APIs. Offline suite `test_adapter_fixtures.py` (manifest/registry/profile/mock-ATS integrity; no-network and no-secret assertions) + `test_contract_parity.py` (canonical `JobStatus` vs ARCHITECTURE_PLAN §5; enum/field parity vs backend schema with graceful skips; contract-example + frozen error-envelope validation; opt-in live OpenAPI via `AUTOJOB_OPENAPI_URL`). `backend/tests/contract_examples/` scaffolded with the §7 endpoint inventory; `backend/fixtures/README.md` documents the manifest schema and determinism rules. Verified locally: **35 passed / 5 skipped** (skips = backend schema not present, no example files yet, live check unset).
Next: Weeks 1–2 — record Greenhouse + Lever multi-step application pages into `fixtures/greenhouse` / `fixtures/lever`, expand the manifest, and drive adapters with `page.set_content` asserting every field is identified-and-filled **or** the adapter cleanly pauses.
Blocked: none. (Note: `backend/app/schemas/job.py` is absent, so schema/enum parity tests skip — expected until backend M0 lands it.)
Fixture count: 0 recorded · 3 manifest entries (1 synthetic file) · 115 companies / 121 board tokens
Bugs filed: none
