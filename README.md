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
