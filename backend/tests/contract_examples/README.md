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
    post_internal_shutdown.request.json
    post_internal_shutdown.response.json
  profile/
    get_profile.response.json
    post_profile.request.json / .response.json
    post_profile_import_resume.request.json / .response.json
    post_profile_import_resume_confirm.request.json / .response.json
    get_profile_qa.response.json
    post_profile_qa.request.json / .response.json
  jobs/
    get_jobs.request.json / .response.json
    get_job.response.json
    post_jobs_crawl.request.json / .response.json
    post_job_action.request.json / .response.json
    get_jobs_sources.response.json
    post_jobs_sources.request.json / .response.json
    delete_jobs_sources_company.response.json
  artifacts/
    post_matcher_tailor.request.json / .response.json
    get_matcher_resume.response.json
    get_matcher_cover_letter.request.json / .response.json
  applications/
    get_applications.request.json / .response.json
    get_application.response.json
    get_application_screenshot.response.json
    post_application_start.request.json / .response.json
    post_application_approve.request.json / .response.json
    post_application_abort.request.json / .response.json
  browser/
    get_browser_status.response.json
    post_browser_launch.request.json / .response.json
    post_browser_close.request.json / .response.json
  settings/
    get_settings.response.json
    post_settings.request.json / .response.json
    post_settings_platform_optin.request.json / .response.json
    post_settings_llm_key.request.json / .response.json
  errors/
    <code>.error.json                # {"error": {"code","message","details"}}
```

- `<method>_<path-slug>.request.json` and `<method>_<path-slug>.response.json`, grouped in one directory per contract area. Path parameters are collapsed (`/jobs/{id}` → `get_job`, `/jobs/{id}/action` → `post_job_action`, `/jobs/sources/{company}` → `delete_jobs_sources_company`).
- **Request files** exist only where the endpoint takes a body or a query string. Query-string requests are documented as a flat JSON object of the query params (`get_jobs.request.json` → `{"page": 1, "page_size": 50, "sort": "score"}`). Bodyless GETs ship no request file; bodyless POSTs ship `{}`.
- **Multipart** (`POST /profile/import-resume`) and **binary** endpoints (`matcher/resume`, `matcher/cover-letter`, `applications/{id}/screenshot`) cannot carry JSON bodies; their `.request.json` / `.response.json` files are descriptors (`content_type`, `parts`/`job_id`, a `note`) documenting the envelope — the live payload is form-data or raw bytes.
- Error bodies live under `errors/` as `<code>.error.json` and **must** use the frozen envelope; `code` must be one of the documented codes.
- Every file is a single JSON document. Deterministic ids/timestamps only (fixed literals, e.g. `2026-11-10T18:03:11Z`), never `now()`. All UUIDs are v4-format literals; all scores sit in the realistic 62–95 band; companies are Stripe/Ramp/Notion-class.

## Frozen error envelope

```json
{ "error": { "code": "job_not_found", "message": "Job 123 does not exist", "details": {} } }
```

Codes: `validation_error` (422), `not_found`, `job_not_found`, `application_not_found`, `cap_reached` (409), `company_cooldown` (409), `outside_working_hours` (409), `browser_not_running` (409), `linkedin_not_opted_in` (403), `fact_check_failed` (422), `budget_exceeded` (503), `llm_not_configured` (503), `render_failed` (500), `captcha_blocked` (409), `rate_limited` (429). All 15 codes have an example under `errors/`.

## Endpoint inventory (§7) → files

| Area | Method | Path | Examples |
| :--- | :--- | :--- | :--- |
| Health | GET | `/health` | `health/get_health.response.json` |
| Health (internal) | POST | `/internal/shutdown` | `health/post_internal_shutdown.request.json`, `.response.json` |
| Profile | GET | `/api/v1/profile` | `profile/get_profile.response.json` |
| Profile | POST | `/api/v1/profile` | `profile/post_profile.request.json`, `.response.json` |
| Profile | POST | `/api/v1/profile/import-resume` | `profile/post_profile_import_resume.request.json`, `.response.json` |
| Profile | POST | `/api/v1/profile/import-resume/confirm` | `profile/post_profile_import_resume_confirm.request.json`, `.response.json` |
| Profile | GET | `/api/v1/profile/qa` | `profile/get_profile_qa.response.json` |
| Profile | POST | `/api/v1/profile/qa` | `profile/post_profile_qa.request.json`, `.response.json` |
| Jobs | GET | `/api/v1/jobs` | `jobs/get_jobs.request.json`, `.response.json` |
| Jobs | GET | `/api/v1/jobs/{id}` | `jobs/get_job.response.json` |
| Jobs | POST | `/api/v1/jobs/crawl` | `jobs/post_jobs_crawl.request.json`, `.response.json` |
| Jobs | POST | `/api/v1/jobs/{id}/action` | `jobs/post_job_action.request.json`, `.response.json` |
| Jobs | GET | `/api/v1/jobs/sources` | `jobs/get_jobs_sources.response.json` |
| Jobs | POST | `/api/v1/jobs/sources` | `jobs/post_jobs_sources.request.json`, `.response.json` |
| Jobs | DELETE | `/api/v1/jobs/sources/{company}` | `jobs/delete_jobs_sources_company.response.json` |
| Artifacts | POST | `/api/v1/matcher/tailor/{job_id}` | `artifacts/post_matcher_tailor.request.json`, `.response.json` |
| Artifacts | GET | `/api/v1/matcher/resume/{job_id}` | `artifacts/get_matcher_resume.response.json` (descriptor) |
| Artifacts | GET | `/api/v1/matcher/cover-letter/{job_id}` | `artifacts/get_matcher_cover_letter.request.json`, `.response.json` (descriptor) |
| Applications | GET | `/api/v1/applications` | `applications/get_applications.request.json`, `.response.json` |
| Applications | GET | `/api/v1/applications/{id}` | `applications/get_application.response.json` |
| Applications | GET | `/api/v1/applications/{id}/screenshot` | `applications/get_application_screenshot.response.json` (descriptor) |
| Applications | POST | `/api/v1/applications/start/{job_id}` | `applications/post_application_start.request.json`, `.response.json` |
| Applications | POST | `/api/v1/applications/approve/{id}` | `applications/post_application_approve.request.json`, `.response.json` |
| Applications | POST | `/api/v1/applications/abort/{id}` | `applications/post_application_abort.request.json`, `.response.json` |
| Browser | GET | `/api/v1/browser/status` | `browser/get_browser_status.response.json` |
| Browser | POST | `/api/v1/browser/launch` | `browser/post_browser_launch.request.json`, `.response.json` |
| Browser | POST | `/api/v1/browser/close` | `browser/post_browser_close.request.json`, `.response.json` |
| Settings | GET | `/api/v1/settings` | `settings/get_settings.response.json` |
| Settings | POST | `/api/v1/settings` | `settings/post_settings.request.json`, `.response.json` |
| Settings | POST | `/api/v1/settings/platform-optin` | `settings/post_settings_platform_optin.request.json`, `.response.json` |
| Settings | POST | `/api/v1/settings/llm-key` | `settings/post_settings_llm_key.request.json`, `.response.json` (key never echoed) |
| Errors | all | all non-2xx | `errors/<code>.error.json` × 15 |

Pagination convention: `?page=1&page_size=50` → `{ "items": [...], "total": 412, "page": 1, "page_size": 50 }`.

Canonical vocabularies used across these files (§2.3): job statuses `discovered | filtered_out | score_queued | scored | skipped | tailoring | ready_to_apply | applying | applied | failed | archived`; application statuses `QUEUED | STARTING | AUTOFILLING | PAUSED_FOR_REVIEW | SUBMITTED | FAILED | BLOCKED | CAPTCHA_BLOCKED | DISCARDED`; profile-QA `source` `DETERMINISTIC | USER_VERIFIED` (§7.1); run-time QA provenance in `qa_answers` `DETERMINISTIC | LLM_GENERATED | USER_OVERRIDE` plus the `UNRESOLVED` state; `fact_check_status` `PASSED | FAILED`.

## Resolved spec ambiguities (§7 does not pin these shapes)

1. **`POST /jobs/sources` / `DELETE /jobs/sources/{company}` responses** are unspecified → POST echoes the created source `{company, providers, enabled}`; DELETE returns `{deleted, company}`.
2. **`POST /settings/platform-optin` response** is unspecified → returns the full settings object (same semantics as `POST /settings`), with `linkedin_opt_in: true`.
3. **`POST /settings/llm-key` response** is unspecified beyond "never returned" → minimal `{"status": "stored"}`; the key appears in no response.
4. **`POST /browser/close` response** is unspecified → status-shaped body with `running: false`.
5. **`profile_not_found`** is named in §7.1 prose but is **not** in the frozen error-code list (and the parity test rejects it) → the before-onboarding 404 is exemplified under the generic `not_found` code with `details.resource = "profile"`.
6. **QA provenance vocabularies differ by side**: §7.1 fixes `source=USER_VERIFIED` for the profile QA bank; the applier's `qa_answers_audit` uses `DETERMINISTIC | LLM_GENERATED | USER_OVERRIDE` plus the `UNRESOLVED` pause state. Each example file uses its own side's vocabulary.
7. **`POST /applications/approve`** is exemplified in its sync form `{"status": "SUBMITTED"}`; the async `SUBMITTING`-then-WS variant from §7.4 prose is not exemplified.
8. **`POST /internal/shutdown`** lives in §7.0 but outside `/api/v1` and `openapi.json`; its example is kept under `health/` for completeness and is excluded from the parity test's documented-path list.
9. **Binary streams** have no JSON body; the shipped descriptors document status/content-type only, by necessity.

WebSocket §8 (`WS /ws/telemetry`) is not in `openapi.json` and is not part of this §7 example set; its event shapes are documented in `docs/BACKEND_IMPLEMENTATION_SPEC.md` §8 and will get example files under `contract_examples/ws/` later.

> **Status:** complete for §7.0–7.6 — 66 files (31 responses, 20 requests, 15 error envelopes; includes 4 binary/multipart descriptors counted in their areas). `test_contract_parity.py` validates JSON validity and the frozen error envelope; the live OpenAPI check remains opt-in via `AUTOJOB_OPENAPI_URL`.
