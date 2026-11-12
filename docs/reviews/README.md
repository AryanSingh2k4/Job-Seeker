# Milestone Reviews

The integration lead writes one file per milestone: `M{n}-review.md` for backend and `D{n}-review.md` for desktop.

**Verdict:** `PASS` · `PASS-WITH-FIXES` · `BLOCK`

## Template

```markdown
# M{n} Review — <date>

**Verdict:** PASS | PASS-WITH-FIXES | BLOCK
**Reviewer:** OpenCode (integration lead)
**Contract snapshot:** docs/contract/openapi-M{n}.json

## Gate results

| # | Check | Result | Notes |
| :--- | :--- | :--- | :--- |
| 1 | Boot + /health shape | ✅/❌ | |
| 2 | Alembic on empty DB + PRAGMAs | ✅/❌ | |
| 3 | pytest + coverage | ✅/❌ | |
| 4 | Golden Rules audit | ✅/❌ | |
| 5 | OpenAPI diff (additive only) | ✅/❌ | |
| 6 | Security (localhost, keyring, no secrets) | ✅/❌ | |
| 7 | Smoke script | ✅/❌ | |
| 8 | UI contract reality | ✅/❌ | |

## Findings

### [P1] <title>
Repro:
Expected:
Actual:
Impact:
Contract ref:

## Required before close
- [ ] ...

## Notes for next milestone
- ...
```

## Desktop gate checklist (D0–D3)

Used in addition to the M-gates for every desktop milestone (`DESKTOP_PACKAGING_SPEC.md` §15–16).

| # | Check | Pass condition |
| :--- | :--- | :--- |
| D1 | Installer on a clean Windows VM | No Python/Node/Chrome required; onboarding completes |
| D2 | Sidecar handshake | Window appears only after `AUTOJOB_READY`; port/token match |
| D3 | Token enforcement | `/api/v1/*`, `/ws/*`, `/internal/*` reject a missing/wrong token (401) |
| D4 | Host guard | Spoofed `Host` header rejected (403) |
| D5 | No secrets in logs | `Authorization`, `?token=`, keyring values never appear |
| D6 | Graceful shutdown | `POST /internal/shutdown` exits within grace; no orphan process |
| D7 | Crash recovery | Kill sidecar mid-run → restart → run reconciled `FAILED/INTERRUPTED`, no duplicate submit |
| D8 | Migration + backup | Upgrade writes `pre-migration-*.db`; failure exits `78` with a repair path |
| D9 | Uninstall | "Keep data" retains `%APPDATA%`; "Delete" requires typed confirmation |
| D10 | Updater | Signed manifest accepted; unsigned/tampered rejected; deferred during an active run |
| D11 | Offline | UI loads, offline banner, no crash, local screens usable |
| D12 | DPI + a11y | 100/125/150/200% no clipping; keyboard path; focus visible |
| D13 | Performance budget | Cold start < 1.5 s window, sidecar ready < 4 s, idle RAM < 700 MB |
| D14 | CSP | No violations in release console; no remote asset requests |

**Verdict rule:** any ❌ in D1–D10 is a **BLOCK**; D11–D14 may be `PASS-WITH-FIXES`. Desktop GA (G5) requires every row green on the release build.