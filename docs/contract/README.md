# Contract Snapshots

Owned by the integration lead. The contract itself is frozen in `docs/BACKEND_IMPLEMENTATION_SPEC.md` §7–8.

## Rules

- Backend exports `GET /openapi.json` at the end of every milestone.
- File name: `openapi-M{n}.json` (e.g. `openapi-M1.json`).
- Example payloads live in `examples/<endpoint>.json` and are used by the frontend's MSW handlers.
- Snapshots are committed, not regenerated on the fly, so contract drift is visible in diffs.
- Only additive changes are allowed between snapshots; a breaking change bumps `CONTRACT_VERSION` and gets a same-day cutover.

## Transport vs. contract

The OpenAPI document describes **HTTP shape only**. The desktop shell↔sidecar boundary (`docs/DESKTOP_PACKAGING_SPEC.md` §4) is **transport-level** and is *not* part of the snapshot:

- OS-assigned port (`--port 0`) and the `AUTOJOB_READY` stdout handshake.
- Per-launch bearer token (`Authorization: Bearer …`, WS `?token=…`).
- Strict `Host` check and the `POST /internal/shutdown` endpoint.
- CORS origins (`tauri://localhost`, `http://tauri.localhost`, `https://tauri.localhost`, dev origins).

A snapshot diff must never contain these. If an endpoint's *payload* changes for desktop, that is a normal additive contract change and is snapshotted.

## Frontend type generation

```powershell
npx openapi-typescript ..\docs\contract\openapi-M1.json -o lib\api\generated\schema.ts
```

Run from `frontend/`. Generated files are committed so CI typechecks without the backend running.

## Milestones

| Snapshot | Milestone | Status |
| :--- | :--- | :--- |
| `openapi-M0.json` | Week 0 skeleton | pending |
| `openapi-M1.json` | discovery + jobs | pending |
| `openapi-M2.json` | matcher | pending |
| `openapi-M3.json` | tailoring | pending |
| `openapi-M4.json` | applier | pending |
| `openapi-M5.json` | LinkedIn + autonomous | pending |
| `openapi-M6.json` | hardening (final) | pending |