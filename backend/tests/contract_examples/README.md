# Contract Examples — `/api/v1` request/response fixtures

**Owner:** DeepSeek (contract parity). **Consumer:** ZCode (frontend) develops against these; Gemini (backend) must make its live `GET /openapi.json` match them.
**Authority:** `docs/BACKEND_IMPLEMENTATION_SPEC.md` §7–8 is **FROZEN**. These files must mirror it byte-for-byte in shape. If the contract itself looks wrong, raise it in `docs/STATUS.md` `Blocked:` — do **not** invent endpoints or fields here.

## Purpose

One **request** and one **response** JSON per documented endpoint, plus the error-envelope examples. `backend/tests/test_contract_parity.py` validates every file here and (when `AUTOJOB_OPENAPI_URL` is set) checks the live schema covers the documented paths.

## File conventions

```
contract_examples/
  README.md
  health/
    get_health.response.json
  jobs/
    get_jobs.request.json
    get_jobs.response.json
    get_job.request.json
    get_job.response.json
  errors/
    not_found.error.json            # {"error": {"code","message","details"}}
    validation_error.error.json
    cap_reached.error.json
  ...
```

- `<method>_<path-slug>.request.json` and `<method>_<path-slug>.response.json`.
- Error bodies live under `errors/` as `<code>.error.json` and **must** use the frozen envelope; `code` must be one of the documented codes.
- Every file is a single JSON document. Deterministic ids/timestamps only (fixed literals, e.g. `2026-11-10T18:03:11Z`), never `now()`.

## Frozen error envelope

```json
{ "error": { "code": "job_not_found", "message": "Job 123 does not exist", "details": {} } }
```

Codes: `validation_error` (422), `not_found`, `job_not_found`, `application_not_found`, `cap_reached` (409), `company_cooldown` (409), `outside_working_hours` (409), `browser_not_running` (409), `linkedin_not_opted_in` (403), `fact_check_failed` (422), `budget_exceeded` (503), `llm_not_configured` (503), `render_failed` (500), `captcha_blocked` (409), `rate_limited` (429).

## Endpoint inventory (§7)

| Area | Method | Path | Notes |
| :--- | :--- | :--- | :--- |
| Health | GET | `/health` | Token required in sidecar mode. |
| Profile | GET, POST | `/api/v1/profile` | `404 profile_not_found` before onboarding. |
| Profile | POST | `/api/v1/profile/import-resume` | `multipart/form-data file=@resume.pdf`. |
| Profile | POST | `/api/v1/profile/import-resume/confirm` | Merges accepted draft items. |
| Profile | GET, POST | `/api/v1/profile/qa` | Upsert by `question_canonical`. |
| Jobs | GET | `/api/v1/jobs` | Paginated; `status,min_score,source,workplace_type,remote_only,page,page_size,sort`. |
| Jobs | POST | `/api/v1/jobs/crawl` | `{"sources": [...]}` → `{"started": true, "sweep_id": "..."}`. |
| Jobs | GET | `/api/v1/jobs/{id}` | + `description_clean`, `parsed`, `score_breakdown`, `tailored`. |
| Jobs | POST | `/api/v1/jobs/{id}/action` | `approve|skip|archive|tailor`. |
| Jobs | GET, POST | `/api/v1/jobs/sources` | Company sources. |
| Jobs | DELETE | `/api/v1/jobs/sources/{company}` | |
| Artifacts | POST | `/api/v1/matcher/tailor/{job_id}` | `422 fact_check_failed` with diff. |
| Artifacts | GET | `/api/v1/matcher/resume/{job_id}` | `application/pdf`. |
| Artifacts | GET | `/api/v1/matcher/cover-letter/{job_id}` | `?format=txt\|pdf`. |
| Applications | GET | `/api/v1/applications` | Paginated. |
| Applications | GET | `/api/v1/applications/{id}` | + `qa_answers`, `events`. |
| Applications | GET | `/api/v1/applications/{id}/screenshot` | `image/png`. |
| Applications | POST | `/api/v1/applications/start/{job_id}` | Pre-checks → `cap_reached`/`company_cooldown`/… |
| Applications | POST | `/api/v1/applications/approve/{id}` | Final submit click. |
| Applications | POST | `/api/v1/applications/abort/{id}` | Discard modal cleanly. |
| Browser | GET | `/api/v1/browser/status` | |
| Browser | POST | `/api/v1/browser/launch`, `/api/v1/browser/close` | |
| Settings | GET, POST | `/api/v1/settings` | |
| Settings | POST | `/api/v1/settings/platform-optin` | Phrase-gated LinkedIn opt-in. |
| Settings | POST | `/api/v1/settings/llm-key` | Stored in keyring; never returned. |

WebSocket §8 (`WS /ws/telemetry`) is not in `openapi.json`; its event shapes are documented in `docs/BACKEND_IMPLEMENTATION_SPEC.md` §8 and will get example files under `contract_examples/ws/` in Weeks 3–4.

Pagination convention: `?page=1&page_size=50` → `{ "items": [...], "total": 412, "page": 1, "page_size": 50 }`.

> **Status:** placeholders only. Examples land in **Weeks 3–4**, once backend schemas exist. Until then `test_contract_parity.py` skips the schema/enum checks and the live OpenAPI check is opt-in via `AUTOJOB_OPENAPI_URL`.
