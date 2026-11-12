# JobSeeker: Risk, Safety & Quality Audit — v2

**Auditor role:** Independent verification pass over the v2 (website-only) architecture
**Target:** `ARCHITECTURE_PLAN.md` v2.0.0 and component specs in `docs/`
**Date:** 2026-11-11
**Relationship to v1 audit:** The v1 audit was self-review — same authorship as the plan, self-assigned 9–10/10 scores, and a "ToS VERIFIED (COMPLIANT)" verdict that was factually wrong for LinkedIn. This document replaces it. No scores are self-assigned here; each finding states a risk level and where the architecture stands relative to it.

---

## 1. Verdict

The v2 architecture — website-only UI, dedicated visible automation browser, selection-only tailoring, HITL-by-default submission — is **approved for implementation**, with all mandatory amendments (§7) incorporated into the v2 documents. The material weaknesses found in v1 (broken CDP premise, dishonest ToS framing, internal contradictions, missing cost/testing/security design) are resolved. Residual risks that **cannot be eliminated, only managed**, are listed honestly in §8.

---

## 2. Findings Incorporated from the Independent Review

| # | v1 flaw | Resolution in v2 |
| :--- | :--- | :--- |
| F1 | Core runtime premise dead: Chrome ≥136 ignores `--remote-debugging-port` on the default profile; attaching to the user's daily Chrome is impossible | Dedicated app-managed automation profile (persistent headed context, one-time logins) + Browser Runtime Manager + login wizard |
| F2 | ToS mislabeled "compliant" for LinkedIn | Honest lanes (§3): LinkedIn = user-accepted-risk opt-in; direct ATS = safe default. Typed acknowledgment required |
| F3 | Chrome extension + HUD + Tauri = complexity without necessity | Removed; the dashboard is the sole UI; review happens in the visible browser window. *(v2.2 restores a Tauri shell as packaging, not as a second UI: see §11.)* |
| F4 | No MVP; value only after ~6 weeks | 4-week walking skeleton to end-to-end v1 |
| F5 | 8 internal contradictions (autonomous gate 80 vs 95, three status vocabularies, two audit stores, PRAGMA-in-portable-DDL, MV3 WebSocket lifetime, `datetime.utcnow`, missing Ashby in Gantt, tests Phase-3-only) | All unified: one gate (≥95, non-LinkedIn, 100% deterministic, opt-in), one status vocabulary, one audit store, PRAGMAs moved to connection init, tests specified per layer |
| F6 | Fabricated verification claims ("ATS 100/100 verified", "Typst <30ms guaranteed") | Replaced by a defined, runnable round-trip test and honest wording |
| F7 | Missing: cost model, secrets design, testing strategy, backups, fixture strategy | All added (master plan §7, §8, §10; applier §9) |

---

## 3. Platform Terms-of-Service — Truth Table

| Platform | What we do | ToS reality | Architecture stance |
| :--- | :--- | :--- | :--- |
| **Greenhouse / Lever / Ashby** | Query public board APIs (read); submit via public application forms (write) | Public endpoints intended for candidates; no automation-prohibition conflict on application forms; standard API politeness expected | **Default lane.** Rate-limited (≤30 req/min), circuit-broken |
| **LinkedIn** | Easy Apply automation (opt-in); authenticated search crawl | **User Agreement §8.2 prohibits automated access.** This is a ToS violation regardless of stealth; account restriction is a real possibility | **Opt-in risk lane.** Typed acknowledgment, ≤25/day, cooldowns, jitter, working hours, dedicated profile. Never labeled "compliant" |
| **Indeed / Glassdoor** | Discovery scraping only (no automated apply) | Scraping is ToS-gray and actively defended (Cloudflare) | **Best-effort only**, circuit-broken, pinned jobspy version, expected to break periodically |

**Mandatory gate (Amendment 6):** the LinkedIn lane stays disabled until the user types an explicit acknowledgment phrase in Settings; the acknowledgment restates, in plain words, that automation violates LinkedIn's User Agreement and may lead to account restriction.

---

## 4. CAPTCHA Governance

Zero-bypass policy verified in `form_automation_engine_design.md` §7.4 — no solver services, no auto-click-through, no solver APIs anywhere in the design. Detection → freeze → foreground window + chime + WS alert → human solves → resume. AFK 5-minute timeout aborts with `CAPTCHA_BLOCKED` and pauses the platform queue; 2 challenges/30 min → 4-hour cooldown. **Compliant and effective.**

---

## 5. Truthfulness Controls (resume/cover/Q&A)

Verified end-to-end in `ATS_MATCHING_AND_TAILORING_SPEC.md`:

1. **Ground-truth master profile** with bullet pool; import produces `unverified` drafts that require human confirmation before use — the import path can't launder fabrications into "facts."
2. **Selection-only tailoring**: the generator picks/orders verified bullets; it cannot write new claims.
3. **Immutable metric constants**: any number change → `MetricTamperingException` → fact-diff FAIL → baseline fallback.
4. **Q&A high-stakes gate**: legal/auth/clearance/exact-years questions resolve from verified profile or pause for the human — never LLM-guessed.
5. **Provenance is visible**: every submitted answer carries DETERMINISTIC/LLM/UNRESOLVED provenance in the audit trail and the UI.

**Residual risk:** the user can still *manually* enter false facts into their own profile. That is outside the system's control; the UI repeatedly labels master-profile data as "claims that will appear on your resumes."

---

## 6. HITL & Anti-Spam

- Assisted mode is the default; the final screen of the real form is the review surface (nothing hidden behind an overlay); the dashboard mirrors state and can trigger submit.
- Autonomous mode is quadruple-gated (non-LinkedIn ATS + ≥95 + 100% deterministic answers + explicit opt-in) — a single unified contract across all docs in v2.
- Hard gates (visa/location/seniority), score thresholds (≥80 / 65–79 / <65), 14-day company cooldown, global daily cap 20 (default), working-hours window.
- Every application produces an audit record with screenshot, receipt, and full answer trail.

---

## 7. Mandatory Amendments (status: incorporated in v2)

| # | Amendment | Status |
| :--- | :--- | :--- |
| A1 | Company cooldown: ≤1 application/company/14-day window | Incorporated (master §4.3, applier §7.3) |
| A2 | High-stakes screening questions: profile-or-human, never LLM | Incorporated (applier §5, matcher spec) |
| A3 | Immutable metric constants in tailoring | Incorporated (matcher spec §4; `MetricTamperingException`) |
| A4 | CAPTCHA AFK timeout (5 min) + platform pause/cooldown | Incorporated (applier §7.4) |
| A5 | Atomic DB-level rate-limit checks before every run | Incorporated (applier §7.3) |
| A6 | LinkedIn typed risk-acknowledgment opt-in gate | **New in v2** (master §11, this doc §3) |
| A7 | Single unified audit store (no separate audit DB) | **New in v2** (master §5) |
| A8 | Secrets (LLM keys, vault key) in OS keyring; web binds localhost only; PII screenshots stay local | **New in v2** (master §7) |

---

## 8. Residual Risks (cannot be eliminated — managed and disclosed)

1. **LinkedIn account restriction** — possible even with every harm-reduction control. The opt-in gate exists precisely so this risk is accepted knowingly, not discovered accidentally.
2. **Aggregator breakage** — LinkedIn/Indeed scraping will break periodically; discovery may degrade to Tier-1 (still substantial: direct ATS). Not a safety risk; an availability one.
3. **Selector rot** — ATS form redesigns will break adapters. Mitigated by fixture tests and loud `failure_stage` failures that pause rather than mis-fill. Permanent maintenance cost.
4. **Cost overrun** — managed by cheap-first routing + budget guard; worst case degrades to local-model scoring, visibly flagged.
5. **Human error in the master profile** — the system faithfully automates what the user claims; it cannot audit the user's honesty.
6. **Chrome platform changes** — v1 was killed by one; v2 pins Chrome-for-Testing and documents the fallback (extension-executor mode) if persistent contexts are ever restricted.

---

## 9. Sign-Off

The v2 architecture is **approved for implementation** with amendments A1–A8 incorporated. The critical difference from the v1 audit: this approval asserts only what the design guarantees (controls present, contracts unified, risks disclosed) — not unearned "compliance" or unverifiable scores.

---

## 10. v2.1 Addendum (2026-11-11)

Changes since this audit: the frontend is Next.js running as its own local process; the build runs as two parallel agent tracks; the schema gains `education`, `projects`, `certifications`, and `resume_import_drafts`; stealth/proxy content was removed from the discovery doc; "factual rephrasing" was removed from the matcher spec.

**None of these change the safety posture.** Specifically:

- Next.js does not touch the automation browser; the applier remains the only component that drives Chrome.
- The two-process split adds one more localhost surface. Both services bind `127.0.0.1`; CORS is limited to the two local frontend origins; there is still no auth stack and no remote exposure. *(Superseded for the desktop build by §11: the sidecar adds a per-launch bearer token + strict Host check.)*
- `resume_import_drafts` strengthens the truthfulness control: drafts are physically separated from master tables and the matcher cannot read them.
- Removing stealth patching and proxy pools aligns the implementation with the audit's honest framing rather than weakening it.
- Amendments A1–A8 remain in force and are not renegotiable.

The residual risks in §8 are unchanged.

---

## 11. v2.2 Addendum — Tauri 2 desktop shell (2026-11-11)

Changes since the v2.1 addendum: the product ships as a **Windows desktop app** — a Tauri 2 shell hosting the Next.js dashboard (static export) and a bundled Python sidecar (FastAPI + SQLite), plus the unchanged visible automation Chrome. The v2.1 statement "no auth stack" is **superseded for the desktop build**: the sidecar now requires a per-launch bearer token.

**Safety posture: strengthened, not weakened.** Controls added:

| Control | Guarantee |
| :--- | :--- |
| **Per-launch bearer token** | Generated by the sidecar (32 random bytes), held only in shell memory, injected into the webview at runtime. Any other local process — or a malicious page via DNS rebinding — cannot call the API without it. The token is never in argv, localStorage, logs, or the DB. |
| **Strict `Host` guard** | Requests whose `Host` is not `127.0.0.1:<port>` / `localhost:<port>` are rejected, closing the DNS-rebinding path. |
| **CORS allowlist** | Only the Tauri origins and dev origins; no cookies/credentials. |
| **CSP** | `connect-src` restricted to localhost; no remote scripts/fonts/images/frames; `object-src`/`frame-src` `none`. |
| **Least-privilege capabilities** | Shell can spawn only `autojob-core`, not arbitrary commands; filesystem scoped to app data + user-chosen save paths; external links `http`/`https` only, user-click only. |
| **Devtools off in release** | No debug surface in the shipped build. |
| **Signed updates** | Tauri updater verifies minisign signatures; a tampered or unsigned manifest is rejected. Pre-update DB backup; never mid-run. |
| **Pre-migration backup** | `VACUUM INTO` before `alembic upgrade`; failure exits `78` with a repair screen — never a half-migrated DB. |
| **Crash reconciliation** | Interrupted runs become `FAILED` + `INTERRUPTED` audit rows on next boot; no duplicate submit. |
| **Local-only data** | `%APPDATA%\JobSeeker` under the user's OS ACL; **no telemetry, no analytics, no crash uploads**. Diagnostics are user-exported and exclude secrets/screenshots by default. |

**Unchanged:** selection-only tailoring, immutable metrics, deterministic fact-diff, HITL final click, zero CAPTCHA bypass, hard caps/cooldowns, and the LinkedIn typed opt-in. Packaging does not touch any of them.

**Accepted residual risks (disclosed, not hidden):**

- SQLite is **unencrypted at rest**; the OS user ACL is the boundary. Documented in About.
- Unsigned builds show SmartScreen "Unknown publisher"; only signed builds are release-grade.
- A desktop app is **local by definition** — no remote/mobile access in v1 (Tailscale is an optional user add-on, not a shipped feature).
- The automation Chrome remains a separate visible window; the shell does not sandbox it further.

**Verdict:** approved. The desktop revision adds a real local-auth boundary and a verifiable update channel to the v2 posture. Amendments A1–A8 remain in force.
