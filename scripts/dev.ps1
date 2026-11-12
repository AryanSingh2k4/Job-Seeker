# JobSeeker dev launcher (Week 0).
# Frontend: Next.js dev server on :3000 (hot reload).
# Backend:  sidecar expected on :8000 — run `uvicorn app.main:app` in backend/
#           once Gemini's M0 lands, or nothing (screens show the offline banner,
#           or NEXT_PUBLIC_MSW=1 for fixture mode).

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "JobSeeker dev launcher" -ForegroundColor Cyan
Write-Host "  frontend -> http://localhost:3000 (next dev)"
Write-Host "  backend  -> http://127.0.0.1:8000 (start manually: cd backend; uvicorn app.main:app)"

Push-Location "$root/frontend"
try {
    npm run dev
} finally {
    Pop-Location
}
