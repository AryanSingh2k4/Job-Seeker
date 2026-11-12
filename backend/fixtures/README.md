# Backend Fixtures — JobSeeker

**Owner:** DeepSeek (fixtures, golden corpus, contract parity).
**Lane:** `backend/fixtures/**` · `backend/tests/test_adapter_fixtures.py` · `backend/tests/test_contract_parity.py` · `backend/tests/contract_examples/**`.
Read-only for everyone else; if the backend (Gemini) needs a change here, it is a bug report in `docs/STATUS.md`, not a patch.

This directory is the **offline test world**: every adapter test replays recorded or synthetic HTML from here, on `page.set_content` / `file://`, with **zero network access**. A live-site redesign surfaces as a failing fixture test, never as a mis-filled application.

---

## Layout

| Path | Kind | Purpose |
| :--- | :--- | :--- |
| `manifest.json` | index | Authoritative fixture index (schema `autojob.fixture-manifest.v1`). Additive-only. |
| `company_registry.json` | seed | Verified public board tokens for Greenhouse / Lever / Ashby. Backend crawl seed. |
| `test_profile.json` | data | Deterministic candidate (Ada Lovelace) referenced by expected field values. |
| `mock_ats/index.html` | synthetic | Single-file, 3-step mock ATS (`contact → screening → review`). |
| `mock_ats/artifacts/resume.pdf` | artifact | Upload fixture for the hidden resume input. |
| `greenhouse/` | recorded | Recorded Greenhouse application pages (Weeks 1–2). |
| `lever/` | recorded | Recorded Lever application pages (Weeks 1–2). |
| `ashby/` | recorded | Recorded Ashby application pages (Weeks 5–6). |
| `linkedin/` | recorded | LinkedIn Easy Apply modal states (Weeks 5–6). |
| `captcha/` | synthetic | CAPTCHA-signature fixtures for freeze/AFK behavior (Weeks 5–6). |
| `workday/` | recorded | Workday portal pages (Phase 4). |
| `jd_corpus/` | corpus | 30 archived JDs + `expected.json` + fact-check mutation cases (Weeks 3–4). |

Recorded directories are empty until their recording week; `.gitkeep` preserves them.

---

## Determinism rules (hard)

1. **Static only.** No timestamps without a fixed value; no `Date.now()`, no random ids. `generated_at` / `recorded_on` are frozen literals.
2. **No live calls in tests.** Adapter tests load fixtures from disk. Network access is a test bug.
3. **No secrets, cookies, or PII.** Recorded pages are stripped of session cookies, auth headers, CSRF tokens, and personal data before they land here. The only identity present is the synthetic `test_profile.json`.
4. **Manifest-driven.** Tests discover fixtures from `manifest.json`; never hard-code a fixture list.
5. **Paths are relative to this directory** and must resolve inside `backend/fixtures/`. A `../` escape is invalid.
6. **Additive changes only.** New fixtures append manifest entries. Existing fixture `id`s are immutable; renaming one is a contract change, raised in STATUS `Blocked:`, not patched silently.
7. **No real employer data.** Synthetic (`mock_ats`, `captcha`) and recorded (public ATS pages) fixtures only; the mock ATS is explicitly labelled as a local test fixture.

---

## `manifest.json` schema

```jsonc
{
  "manifest_version": "1.0.0",
  "schema": "autojob.fixture-manifest.v1",
  "generated_at": "2026-11-11T00:00:00Z",
  "test_profile": "test_profile.json",
  "platforms": { "<platform_id>": { "display_name", "kind": "synthetic|recorded", "spec", "url_hint" } },
  "fixtures": [
    {
      "id": "<platform>.<form_state>",   // unique, stable
      "path": "mock_ats/index.html",      // relative to backend/fixtures/
      "platform": "mock_ats",
      "form_state": "contact",
      "step_index": 1,                    // 1-based, <= total_steps
      "total_steps": 3,
      "source": "synthetic|recorded",
      "recorded_on": null,                // "YYYY-MM-DD" when recorded
      "notes": "...",
      "expected": {
        "fields": [
          {
            "key": "first_name",
            "selector": "#first_name",     // CSS; id / [data-test="…"] / input[name="…"]
            "kind": "text",                // text|email|tel|url|number|textarea|select|radio|checkbox|file
            "required": true,
            "expected_value": "Ada",       // literal the adapter must write
            "profile_path": "full_name.first", // must resolve in test_profile.json when present
            "options": ["a", "b"],         // for select/radio
            "high_stakes": true,           // verified-profile-only; else the adapter must pause
            "upload_fixture": "mock_ats/artifacts/resume.pdf"
          }
        ],
        "next":  { "selector": "[data-test=\"next\"]",  "label": "Continue" },
        "back":  { "selector": "[data-test=\"back\"]",  "label": "Back" },
        "outcome": "fill_and_advance"
      }
    }
  ]
}
```

Every field is asserted by `backend/tests/test_adapter_fixtures.py`:

- ids unique; `path` resolves and cannot escape the fixtures directory;
- `platform` declared in `platforms`; `source` ∈ {`synthetic`, `recorded`}; `1 ≤ step_index ≤ total_steps`;
- `kind` known; required fields carry at least one of `expected_value` / `profile_path` / `upload_fixture`;
- `upload_fixture` files exist on disk;
- **`high_stakes` fields resolve from the verified profile** (`profile_path` or explicit `options`), otherwise the adapter must pause;
- every `expected_value` with a `profile_path` equals the value in `test_profile.json` (single source of truth);
- every `selector` exists in the referenced HTML.

---

## `mock_ats/index.html`

One self-contained HTML file with **three runtime states** driven by inline JS (no three files):

| Step | `data-step` | State | Highlights |
| :--- | :--- | :--- | :--- |
| 1 | `1` | contact | `#first_name #last_name #email #phone #location #linkedin_url #cover_letter`, plus a **visually hidden** `#resume` behind a custom dropzone — the adapter must resolve the hidden input, not click the dropzone. |
| 2 | `2` | screening | High-stakes: `#work_authorization` (select), `input[name="requires_sponsorship"]` (radio), `#years_python` (number). Plus `input[name="willing_to_relocate"]`, `#hear_about_us` (select), `#project_story` (textarea), `#consent` (checkbox). |
| 3 | `3` | review | Read-only `#review_summary`, `#certify`, `[data-test="submit"]`, `[data-test="discard"]`. |

Terminal states: `#confirmation` (`data-status="SUBMITTED"`, receipt `MOCK-ATS-2026-0001`) and `#discarded` (`data-status="DISCARDED"`).
The page exposes a deterministic, side-effect-free test surface at `window.__MOCK_ATS__` (`getState()`, `goToStep(n)`, `reset()`, `receipt`).
There are **no external resources** (no remote scripts/styles/images/iframes/fetch) — asserted by the fixture tests.

---

## `company_registry.json`

- **115 companies / 121 board tokens** verified **2026-11-11** (63 Greenhouse, 5 Lever, 53 Ashby; 6 companies are dual-listed).
- `company_count` counts companies; `provider_counts` counts **boards** (so `sum(provider_counts) = Σ len(providers) ≥ company_count`).
- Verification method is recorded per provider in the `verification` block; each company carries `verified_on`.
- **Tokens drift.** The backend must treat a 404 as a recoverable per-source error — never crash, always log and continue.

---

## Running the offline tests

From the repo root (no network required):

```bash
uv run --no-project --with pytest pytest backend/tests -q
```

`test_adapter_fixtures.py` is fully offline and must always run. `test_contract_parity.py` skips gracefully until `backend/app/schemas/job.py` exists (backend M0); its optional live OpenAPI check is enabled **only** by setting `AUTOJOB_OPENAPI_URL`.

Fixture inventory is reported in `docs/STATUS.md` under `### Fixtures & Tests`.
