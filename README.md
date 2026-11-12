# JobSeeker

Local, single-user job-application desktop app. Product name: **JobSeeker** (repo codename: `Auto-Job`). *"Apply with proof."*

A private Tauri 2 desktop app that finds jobs, scores them against your **verified** resume, builds truthful tailored resumes/cover letters, fills application forms in a **visible automation browser**, and stops before Submit so you make the final call. No cloud, no accounts, no extension.

## Docs

| Read | For |
|---|---|
| `docs/FINAL_EXECUTION_PLAN.md` | **Authoritative plan** — ownership, schedule, decisions log |
| `docs/STATUS.md` | Living build status board (updated daily by all agents) |
| `docs/BACKEND_IMPLEMENTATION_SPEC.md` | Backend spec — **§7–8 = frozen API contract** |
| `docs/FRONTEND_DASHBOARD_DESIGN.md` | Frontend design — screens, tokens, state |
| `docs/DESKTOP_PACKAGING_SPEC.md` | Tauri shell, sidecar handshake, installer, updater |
| `ARCHITECTURE_PLAN.md` | System architecture (v2.2) |

## Repo layout

```
backend/    FastAPI sidecar (Gemini)        frontend/  Next.js dashboard (ZCode)
desktop/    Tauri 2 Rust shell (ZCode)      scripts/   dev/package/release (ZCode)
core/       frozen reference only           docs/      plans, contract snapshots, reviews
```

## Quick start (Week 0)

```powershell
# frontend (web dev mode)
cd frontend
npm install
npm run msw:init        # one-time: generates public/mockServiceWorker.js
npm run dev             # http://localhost:3000  (NEXT_PUBLIC_MSW=1 for fixture mode)

# desktop shell (needs Rust toolchain: rustup + WebView2)
cd desktop/src-tauri
cargo run               # builds jobseeker.exe + autojob-core-stub.exe (stub handshake)

# backend (Gemini M0+)
cd backend && uvicorn app.main:app   # http://127.0.0.1:8000
```

## Build agents

- **Gemini Antigravity** — backend (`backend/**`)
- **ZCode** — frontend + desktop shell + integration lead/reviewer
- **DeepSeek (OpenCode)** — fixtures, golden JD corpus, contract-parity tests

## Build Tracker — live done/pending

**DONE**
- ✅ Docs v2.2: website→desktop architecture, frozen API contract (§7–8), 8-week→accelerated plan
- ✅ Frontend Week 0: Next.js static export, tokens, app shell, typed API/WS clients, MSW, 9 routes — build GREEN
- ✅ Desktop D0: Tauri 2 scaffold + stub sidecar handshake
- ✅ Fixtures base: mock ATS (3-state), company registry (115 companies verified), manifest, parity tests (38→52 green)
- ✅ Phase 0: git baseline (5 commits, venv excluded)
- ✅ Frontend beauty pass: aurora/glass materials, framer-motion, ⌘K palette, glowing score chips, count-ups, progress rings, animated funnel — build GREEN, screens verified visually
- ✅ MSVC Build Tools installed; Rust 1.99.1 working
- ✅ Backend (Gemini) sprint: boots, full §7 route surface, 52 tests passing, /health shape exact

**PENDING**
- ⏳ Backend M0 close-out: /health under /api/v1 (P1 deviation), real openapi-M0.json, PyInstaller sidecar exe
- ⏳ Backend M1–M6: crawler live sweep, matcher scoring, tailor+Typst, applier adapters, LinkedIn gate, stats
- ⏳ Fixture agents running: GH/Lever recordings, 30-JD corpus, contract examples, LinkedIn/Ashby/CAPTCHA
- ⏳ Desktop: cargo build verification (running), then Gate-0 desktop half
- ⏳ Frontend F1: onboarding wizard + job detail
- ⏳ QA orchestrator pass over Phase 2 frontend

**LATEST (accelerated session 2)**
- ✅ QA orchestrator verdict PASS-WITH-FIXES → all 10 findings fixed & pushed
- ✅ 30-JD golden corpus (real postings, live APIs) · GH×3/Lever×2 recordings pushed
- ✅ Gemini P1 (/api/v1/health alias) verified closed by lead boot test
- ⏳ Backend M1–M6 (Gemini, in progress) · openapi-M0 real snapshot · JD-corpus-driven matcher validation
