"""Contract-parity tests for JobSeeker (owner: DeepSeek, fixtures/parity lane).

Two layers:

1. **Static parity (always runs).** The canonical vocabulary in
   ``core/models/job.py`` must match ``ARCHITECTURE_PLAN.md`` §5, and the
   backend schema module ``backend/app/schemas/job.py`` (owned by Gemini) must
   not drift from the canonical enums/fields once it exists. Until it exists
   the schema-specific tests **skip gracefully** — they must never fail because
   the backend has not started M0.

2. **Contract examples (Weeks 3-4).** Every JSON under
   ``backend/tests/contract_examples/**`` is parsed and checked against the
   frozen error envelope. The live ``GET /openapi.json`` comparison runs only
   when ``AUTOJOB_OPENAPI_URL`` is set — never in the default offline suite.
"""

from __future__ import annotations

import ast
import json
import os
import re
import urllib.request
from pathlib import Path

import pytest

TESTS_DIR = Path(__file__).resolve().parent
REPO_ROOT = TESTS_DIR.parents[1]
CORE_MODEL = REPO_ROOT / "core" / "models" / "job.py"
ARCHITECTURE_PLAN = REPO_ROOT / "ARCHITECTURE_PLAN.md"
BACKEND_SCHEMA = REPO_ROOT / "backend" / "app" / "schemas" / "job.py"
EXAMPLES_DIR = TESTS_DIR / "contract_examples"

# Frozen error codes — docs/BACKEND_IMPLEMENTATION_SPEC.md §7.
ERROR_CODES = {
    "validation_error",
    "not_found",
    "job_not_found",
    "application_not_found",
    "cap_reached",
    "company_cooldown",
    "outside_working_hours",
    "browser_not_running",
    "linkedin_not_opted_in",
    "fact_check_failed",
    "budget_exceeded",
    "llm_not_configured",
    "render_failed",
    "captcha_blocked",
    "rate_limited",
}

# Documented HTTP surface (§7). WebSocket (`/ws/telemetry`) and
# `/internal/shutdown` are intentionally excluded: they do not appear in
# openapi.json. Path params use the documented spelling.
DOCUMENTED_PATHS = [
    "/health",
    "/api/v1/profile",
    "/api/v1/profile/import-resume",
    "/api/v1/profile/import-resume/confirm",
    "/api/v1/profile/qa",
    "/api/v1/jobs",
    "/api/v1/jobs/crawl",
    "/api/v1/jobs/{id}",
    "/api/v1/jobs/{id}/action",
    "/api/v1/jobs/sources",
    "/api/v1/jobs/sources/{company}",
    "/api/v1/matcher/tailor/{job_id}",
    "/api/v1/matcher/resume/{job_id}",
    "/api/v1/matcher/cover-letter/{job_id}",
    "/api/v1/applications",
    "/api/v1/applications/{id}",
    "/api/v1/applications/{id}/screenshot",
    "/api/v1/applications/start/{job_id}",
    "/api/v1/applications/approve/{id}",
    "/api/v1/applications/abort/{id}",
    "/api/v1/browser/status",
    "/api/v1/browser/launch",
    "/api/v1/browser/close",
    "/api/v1/settings",
    "/api/v1/settings/platform-optin",
    "/api/v1/settings/llm-key",
]

# Backend-only fields explicitly reviewed and allowed on a shared model class.
# Must stay empty unless a change is approved in docs/STATUS.md.
BACKEND_EXTRA_FIELDS: dict[str, set[str]] = {}


# --------------------------------------------------------------------------- #
# AST helpers
# --------------------------------------------------------------------------- #
def _parse(path: Path) -> ast.Module:
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


def _is_enum(node: ast.ClassDef) -> bool:
    return any(
        isinstance(b, ast.Name) and b.id in {"Enum", "IntEnum", "StrEnum"}
        for b in node.bases
    )


def _is_model(node: ast.ClassDef) -> bool:
    return any(isinstance(b, ast.Name) and b.id == "BaseModel" for b in node.bases)


def _enum_classes(tree: ast.Module) -> dict[str, dict]:
    enums: dict[str, dict] = {}
    for node in tree.body:
        if not isinstance(node, ast.ClassDef) or not _is_enum(node):
            continue
        members: dict = {}
        for stmt in node.body:
            if (
                isinstance(stmt, ast.Assign)
                and len(stmt.targets) == 1
                and isinstance(stmt.targets[0], ast.Name)
            ):
                try:
                    members[stmt.targets[0].id] = ast.literal_eval(stmt.value)
                except (ValueError, SyntaxError):
                    continue
        enums[node.name] = members
    return enums


def _model_classes(tree: ast.Module) -> dict[str, list[str]]:
    models: dict[str, list[str]] = {}
    for node in tree.body:
        if not isinstance(node, ast.ClassDef) or not _is_model(node):
            continue
        fields: list[str] = []
        for stmt in node.body:
            target = None
            if isinstance(stmt, ast.AnnAssign) and isinstance(stmt.target, ast.Name):
                target = stmt.target.id
            elif (
                isinstance(stmt, ast.Assign)
                and len(stmt.targets) == 1
                and isinstance(stmt.targets[0], ast.Name)
            ):
                target = stmt.targets[0].id
            if target and not target.startswith("_"):
                fields.append(target)
        models[node.name] = fields
    return models


def _imported_names(tree: ast.Module) -> set[str]:
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            for alias in node.names:
                names.add(alias.asname or alias.name)
        elif isinstance(node, ast.Import):
            for alias in node.names:
                names.add((alias.asname or alias.name).split(".")[0])
    return names


def _require_backend_schema():
    if not BACKEND_SCHEMA.is_file():
        pytest.skip(
            "backend/app/schemas/job.py not present yet (backend M0 not started) — "
            "parity checks skip until Gemini lands the schema module"
        )


# --------------------------------------------------------------------------- #
# canonical vocabulary (backend-independent)
# --------------------------------------------------------------------------- #
def test_core_model_present():
    assert CORE_MODEL.is_file(), "core/models/job.py is the frozen canonical reference"


def test_core_lifecycle_matches_architecture_plan():
    text = ARCHITECTURE_PLAN.read_text(encoding="utf-8")
    line = next(
        (
            ln
            for ln in text.splitlines()
            if "discovered" in ln and "ready_to_apply" in ln
        ),
        None,
    )
    assert line, "ARCHITECTURE_PLAN.md §5 lifecycle line not found"
    doc_tokens = set(re.findall(r"[a-z_]+", line))
    assert "discovered" in doc_tokens and "ready_to_apply" in doc_tokens

    core = _enum_classes(_parse(CORE_MODEL))
    assert "JobStatus" in core, "core JobStatus enum missing"
    core_values = set(core["JobStatus"].values())
    assert core_values == doc_tokens, (
        f"JobStatus vocabulary drift: core-only={core_values - doc_tokens}, "
        f"doc-only={doc_tokens - core_values}"
    )


def test_documented_paths_are_unique_and_versioned():
    assert len(DOCUMENTED_PATHS) == len(set(DOCUMENTED_PATHS))
    for path in DOCUMENTED_PATHS:
        assert path.startswith("/api/v1/") or path == "/health", path
    assert "/health" in DOCUMENTED_PATHS
    assert "/ws/telemetry" not in DOCUMENTED_PATHS


# --------------------------------------------------------------------------- #
# schema/enum parity (skips until the backend schema module exists)
# --------------------------------------------------------------------------- #
def test_enum_parity_with_core():
    _require_backend_schema()
    core = _enum_classes(_parse(CORE_MODEL))
    backend_tree = _parse(BACKEND_SCHEMA)
    backend = _enum_classes(backend_tree)
    backend_imports = _imported_names(backend_tree)

    shared = sorted(set(core) & set(backend))
    for name in shared:
        assert backend[name] == core[name], (
            f"enum {name} drifted: core={core[name]} backend={backend[name]}"
        )

    # Enums must be defined identically or re-exported from core — never silently dropped.
    for name in core:
        assert name in backend or name in backend_imports, (
            f"canonical enum {name} neither defined nor imported by backend schema"
        )


def test_model_field_parity_with_core():
    _require_backend_schema()
    core = _model_classes(_parse(CORE_MODEL))
    backend_tree = _parse(BACKEND_SCHEMA)
    backend = _model_classes(backend_tree)

    shared = sorted(set(core) & set(backend))
    assert shared, "backend schema defines no shared model with core/models/job.py"

    for name in shared:
        core_fields = set(core[name])
        backend_fields = set(backend[name])
        missing = core_fields - backend_fields
        assert not missing, (
            f"{name}: backend schema is missing fields {sorted(missing)}"
        )
        extras = backend_fields - core_fields - BACKEND_EXTRA_FIELDS.get(name, set())
        assert not extras, (
            f"{name}: backend adds unreviewed fields {sorted(extras)} — "
            "add to BACKEND_EXTRA_FIELDS only with STATUS approval"
        )


# --------------------------------------------------------------------------- #
# contract examples (Weeks 3-4)
# --------------------------------------------------------------------------- #
def test_examples_dir_has_readme():
    assert EXAMPLES_DIR.is_dir(), "backend/tests/contract_examples/ must exist"
    assert (EXAMPLES_DIR / "README.md").is_file()


def _example_files() -> list[Path]:
    if not EXAMPLES_DIR.is_dir():
        return []
    return sorted(EXAMPLES_DIR.rglob("*.json"))


def test_example_files_are_valid_json():
    files = _example_files()
    if not files:
        pytest.skip("no contract examples yet — they land in Weeks 3-4")
    for path in files:
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:  # pragma: no cover - failure path
            pytest.fail(f"{path.relative_to(EXAMPLES_DIR)}: invalid JSON: {exc}")


def test_error_examples_use_frozen_envelope():
    files = [
        p
        for p in _example_files()
        if p.name.endswith(".error.json") or p.parent.name == "errors"
    ]
    if not files:
        pytest.skip("no error-envelope examples yet — they land in Weeks 3-4")
    for path in files:
        body = json.loads(path.read_text(encoding="utf-8"))
        assert set(body.keys()) == {"error"}, (
            f"{path.name}: top level must be {{'error': ...}}"
        )
        envelope = body["error"]
        assert set(envelope.keys()) == {"code", "message", "details"}, (
            f"{path.name}: envelope keys must be code/message/details"
        )
        assert envelope["code"] in ERROR_CODES, (
            f"{path.name}: unknown code {envelope['code']!r}"
        )
        assert isinstance(envelope["message"], str) and envelope["message"]
        assert isinstance(envelope["details"], dict)


# --------------------------------------------------------------------------- #
# optional live parity — opt-in only, never runs by default
# --------------------------------------------------------------------------- #
def test_live_openapi_covers_documented_paths():
    url = os.environ.get("AUTOJOB_OPENAPI_URL")
    if not url:
        pytest.skip(
            "set AUTOJOB_OPENAPI_URL to run live OpenAPI parity (offline by default)"
        )
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            spec = json.load(resp)
    except Exception as exc:  # pragma: no cover - environment dependent
        pytest.skip(f"backend not reachable at {url}: {exc}")

    live_paths = set(spec.get("paths", {}))
    missing = sorted(p for p in DOCUMENTED_PATHS if p not in live_paths)
    assert not missing, f"openapi.json is missing documented paths: {missing}"
