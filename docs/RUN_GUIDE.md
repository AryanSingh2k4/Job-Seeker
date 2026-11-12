# JobSeeker — Run Guide

How to run the backend and frontend separately and together. All commands assume the repo root `C:\Users\aryan\Desktop\Auto-Job`.

## Ports & processes

| Thing | Port | Command runs from |
|---|---|---|
| Backend (FastAPI) | **8000** | `backend/` |
| Frontend dev server | **3000 or 3012** | `frontend/` |
| Automation browser | (spawned by backend on demand) | — |

Rule of thumb: **backend first, then frontend.**

---

## 1. Backend only

```powershell
cd C:\Users\aryan\Desktop\Auto-Job\backend
.venv\Scripts\python -m uvicorn app.main:app --port 8000
```

- Health check: open `http://127.0.0.1:8000/api/v1/health` → should return JSON with `"status": "ok"`.
- Full API docs (interactive): `http://127.0.0.1:8000/docs`
- Background loops start automatically: crawl sweep (every 5 min, max 50 companies/day), matcher (scores queued jobs every 10 s), applier (launches queued applications when gates allow).
- First run: `uv venv`, `.venv\Scripts\pip install -e .`, `alembic upgrade head` (the venv on this machine already exists).

Useful knobs (all via API or Settings page):

```powershell
# trigger a crawl right now (respects the daily company cap)
curl -X POST http://127.0.0.1:8000/api/v1/jobs/crawl -H "Content-Type: application/json" -d "{}"

# see / change rate limits (5-min interval, 50 companies/day by default)
curl http://127.0.0.1:8000/api/v1/settings
```

## 2. Frontend only (fixture mode — no backend needed)

```powershell
cd C:\Users\aryan\Desktop\Auto-Job\frontend
npm install          # once
npm run msw:init     # once — creates public/mockServiceWorker.js
npm run dev          # uses .env.development → NEXT_PUBLIC_MSW=1
```

- Open `http://localhost:3000` — screens render with **mock data** (MSW intercepts the API). The dashboard shows `sidecar 0.1.0-mock`.
- One-time gotcha: if `npm run build` was ever run, wipe `.next` before dev: `rmdir /s /q .next` (PowerShell: `Remove-Item -Recurse -Force .next`).

## 3. Frontend with the REAL backend (the real product)

Terminal 1 — backend (§1). Terminal 2:

```powershell
cd C:\Users\aryan\Desktop\Auto-Job\frontend
$env:NEXT_PUBLIC_MSW=0        # PowerShell; in Git Bash: export NEXT_PUBLIC_MSW=0
npm run dev
```

- Open `http://localhost:3000` — the dashboard badge shows `sidecar 2.0.0 · contract v1` and the Job Inbox fills with **real crawled jobs**.
- If you use a different port than 3000 (e.g. `npm run dev -- -p 3012`), CORS already allows any `localhost` port.

## 4. Production-style run (one process serves everything)

```powershell
# build the static frontend once (wipes .next itself)
cd C:\Users\aryan\Desktop\Auto-Job\frontend
npm run build                # output lands in frontend\out

# the sidecar can serve the built UI — or any static server:
cd ..\backend
.venv\Scripts\python -m uvicorn app.main:app --port 8000
```

The packaged desktop app does exactly this: the Tauri shell loads `frontend/out` and talks to the sidecar over `127.0.0.1` with a per-launch token (see `docs/DESKTOP_PACKAGING_SPEC.md`).

## 5. Desktop app (Rust shell)

Requires the Rust toolchain (installed ✓) + WebView2 (built into Windows):

```powershell
cd C:\Users\aryan\Desktop\Auto-Job\desktop\src-tauri
cargo run
```

Builds `jobseeker.exe` + `autojob-core-stub.exe`. The shell spawns the sidecar (stub in Week-0; the real PyInstaller `autojob-core.exe` from D1), reads the `AUTOJOB_READY` handshake, and shows the dashboard.

## 6. Tests

```powershell
# backend (88 tests + fixtures suite)
cd C:\Users\aryan\Desktop\Auto-Job\backend
.venv\Scripts\python -m pytest tests/ -q

# frontend (type + static export check — never while a dev server is running)
cd C:\Users\aryan\Desktop\Auto-Job\frontend
npm run build
```

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Dashboard says "Backend unreachable" | backend not running, or CORS blocked the origin | start backend (§1); CORS allows any `localhost` port (regex allowlist) |
| Dev server starts with `EADDRINUSE` | zombie process holds the port | `netstat -ano | findstr :3000` → `taskkill /PID <pid> /F /T`; or switch port |
| Random 500s / `MODULE_NOT_FOUND './xxx.js'` | `.next` built by `npm run build` while dev server ran | stop dev server → delete `.next` → start dev again. Never build while dev runs (the build script now wipes `.next` first) |
| Jobs show `score_queued` forever | no LLM key (matcher runs degraded) or no profile | add key via Settings / `POST /settings/llm-key`; complete `/onboarding` |
| Everything scores `skipped` | thin profile (too few skills) or genuinely weak matches | add real skills/experiences in Profile — scores are honest |
| `CAPTCHA_BLOCKED` | a challenge appeared during apply | solve it in the automation browser window within 5 min, or the run aborts by design |
