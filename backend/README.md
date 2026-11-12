# JobSeeker Backend (`autojob-core`)

Production backend service and desktop sidecar for **JobSeeker** — a local, single-user job-application desktop app powered by Tauri 2 (Rust), Next.js 15, and Python FastAPI with visible Playwright browser automation.

---

## 1. System Architecture

```
+-----------------------------------------------------------------------------+
| Tauri 2 Desktop Shell (Rust)                                                |
|   - Spawns autojob-core.exe on port 0 with per-launch token and parent PID  |
|   - Reads AUTOJOB_READY {"port": P, "token": "T", "pid": PID} from stdout   |
|   - Hosts Next.js 15 Static Dashboard (12 export pages)                     |
+------------------------------------+----------------------------------------+
                                     | Local HTTP / WebSocket (127.0.0.1:P)
                                     v
+-----------------------------------------------------------------------------+
| JobSeeker Backend (FastAPI Sidecar)                                         |
|   - app/runtime/ : Token guard, Host header validator, Watchdog, Shutdown  |
|   - app/crawler/ : Greenhouse, Lever, Ashby, JobSpy crawler pipeline        |
|   - app/matcher/ : LLM extraction, hard gates, composite scoring, Typst PDF |
|   - app/applier/ : Dedicated Playwright persistent browser, Q&A resolver,   |
|                    adapters (MockATS, GH, Lever, Ashby, LinkedIn, Workday)  |
|   - app/ws/      : WebSocket telemetry ring buffer                          |
|   - SQLite DB    : WAL mode, 15 relational tables (Alembic schema v2.1)     |
+------------------------------------+----------------------------------------+
                                     | Playwright persistent context (headed)
                                     v
+-----------------------------------------------------------------------------+
| Dedicated Visible Automation Chrome (app-managed --user-data-dir)           |
+-----------------------------------------------------------------------------+
```

---

## 2. Directory Layout

- `app/`
  - `main.py` — FastAPI application root, middlewares, CORS, exception handlers.
  - `cli.py` — Sidecar CLI entrypoint (`--port 0`, `--token`, `--parent-pid`).
  - `config.py` — Pydantic Settings configuration (`AUTOJOB_*` environment variables).
  - `db.py` — SQLite engine, WAL mode pragma, SessionLocal, transaction helpers.
  - `db_backup.py` — Safe `VACUUM INTO` backup engine.
  - `errors.py` — Standardized JSON error envelope (`{"error": {"code": ..., "message": ..., "details": ...}}`).
  - `runtime/` — Security middleware, constant-time bearer token check, Host guard, stdout handshake parser, parent watchdog, `/internal/shutdown`.
  - `schemas/` — Canonical Pydantic schemas (Job, Profile, Application, Health, Settings, Telemetry).
  - `models/` — SQLAlchemy ORM models matching schema v2.1 (15 tables).
  - `crawler/` — Multi-ATS crawler, URL canonicalizer, HTML sanitizer, semantic fingerprint deduplicator, regex prefilter, and JobSpy worker.
  - `matcher/` — Structured JD extractor, hard gate checker, composite scoring formula, Typst compiler (`ats_classic`, `modern_clean`), and ATS round-trip verifier.
  - `applier/` — Playwright browser manager, typing jitter/humanizer, two-tier Q&A resolver, zero-bypass CAPTCHA handler, ATS adapters, and state machine engine.
  - `ws/` — WebSocket `/ws/telemetry` server with 50-event ring buffer.
  - `api/routes/` — Full REST API surface: `/health`, `/jobs`, `/profile`, `/matcher`, `/applications`, `/browser`, `/settings`.
- `packaging/`
  - `autojob-core.spec` — PyInstaller one-folder console build specification.
- `fixtures/`
  - Offline test fixtures, company registry seed, and synthetic `mock_ats/index.html`.
- `templates/`
  - Typst resume templates: `ats_classic.typ` and `modern_clean.typ`.
- `tests/`
  - Complete test suite: M0 through M6, fixture verification, contract parity, and Playwright E2E.

---

## 3. Running & Development

### Prerequisites
- Python 3.13+
- `uv` package manager (`pip install uv` or `winget install astral-sh.uv`)

### Install Dependencies
```bash
cd backend
uv sync
uv run playwright install chromium
```

### Run Local Development Server
```bash
cd backend
uv run uvicorn app.main:app --port 8000 --reload
```

### Run Sidecar Executable Handshake Test
```bash
cd backend
uv run python -m app.cli --port 0
```
Outputs:
```json
AUTOJOB_READY {"port": 54321, "token": "...", "pid": 12345}
```

---

## 4. Building Sidecar Binary

Build the console one-folder executable for desktop packaging:
```bash
cd backend
uv run pyinstaller packaging/autojob-core.spec --noconfirm
```
The executable is generated at:
`backend/dist/autojob-core/autojob-core.exe`

---

## 5. Running the Test Suite

```bash
cd backend
uv run pytest tests -v
```

All tests run offline against recorded and synthetic fixtures.
- `test_adapter_fixtures.py` — Fixture system integrity and offline assertions.
- `test_contract_parity.py` — Schema v2.1 and REST API contract parity.
- `test_db_schema.py` — SQLite WAL mode and table existence tests.
- `test_m0_health.py` — Health endpoint response format verification.
- `test_runtime_security.py` — Host validation, bearer token check, and error envelope tests.
- `test_sidecar_handshake.py` — Port-0 allocation and `AUTOJOB_READY` line verification.
- `test_m1_crawler.py` — Deduplication, fingerprinting, and prefilter tests.
- `test_m2_matcher.py` — Scoring formula, hard gates, and triage tests.
- `test_m3_tailor.py` — Selection-only tailoring, fact check, and Typst compilation tests.
- `test_m4_applier.py` — High-stakes Q&A gates and Playwright Mock ATS E2E test.
- `test_m5_advanced_applier.py` — LinkedIn opt-in enforcement and CAPTCHA detection tests.
- `test_m6_stats_and_export.py` — Applications stats analytics and CSV streaming export tests.
