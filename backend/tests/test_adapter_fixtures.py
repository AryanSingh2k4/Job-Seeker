"""Offline fixture integrity tests for JobSeeker (owner: DeepSeek, fixtures lane).

Everything here runs with **no network access**: it validates the manifest,
the verified company registry, the deterministic test profile, and the
synthetic mock ATS HTML on disk. Adapter behaviour itself is exercised in
Weeks 1-2 by replaying these fixtures; this module guarantees the fixtures the
adapters depend on stay well-formed, deterministic, and free of secrets.

Run:  uv run --no-project --with pytest pytest backend/tests -q
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

FIXTURES_DIR = Path(__file__).resolve().parents[1] / "fixtures"
MANIFEST_PATH = FIXTURES_DIR / "manifest.json"
REGISTRY_PATH = FIXTURES_DIR / "company_registry.json"
MOCK_ATS_PATH = FIXTURES_DIR / "mock_ats" / "index.html"

MANIFEST_SCHEMA = "autojob.fixture-manifest.v1"
PLATFORM_KINDS = {"synthetic", "recorded"}
SOURCES = {"synthetic", "recorded"}
FIELD_KINDS = {
    "text",
    "email",
    "tel",
    "url",
    "number",
    "date",
    "password",
    "textarea",
    "select",
    "radio",
    "checkbox",
    "file",
}
CHOICE_KINDS = {"select", "radio"}
PROVIDERS = {"greenhouse", "lever", "ashby", "workday"}
PROVIDER_TOKEN_FIELD = {
    "greenhouse": "greenhouse_token",
    "lever": "lever",
    "ashby": "ashby",
    "workday": "workday",
}
MOCK_ATS_STATES = {"contact": 1, "screening": 2, "review": 3}
TOKEN_RE = re.compile(r"^[a-z0-9][a-z0-9._-]*$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# Keys that must never appear in any committed fixture (credentials / session).
FORBIDDEN_KEYS = {
    "password",
    "passwd",
    "token",
    "cookie",
    "cookies",
    "api_key",
    "apikey",
    "secret",
    "client_secret",
    "authorization",
    "auth",
    "session",
    "session_id",
    "sessionid",
    "csrf",
    "xsrf",
    "bearer",
    "private_key",
}

# Resource patterns that would make a fixture non-offline / live.
EXTERNAL_PATTERNS = [
    r"<script\b[^>]*\bsrc\s*=",
    r"<link\b[^>]*\bhref\s*=",
    r"<img\b[^>]*\bsrc\s*=",
    r"<iframe\b",
    r"@import\b",
    r"url\(\s*[\"']?\s*(?:https?:)?//",
    r"\bXMLHttpRequest\b",
    r"\bfetch\s*\(",
    r"navigator\.sendBeacon",
    r"\bWebSocket\b",
    r"<form\b[^>]*\baction\s*=\s*[\"']https?:",
]


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def _load_json(path: Path) -> dict:
    assert path.is_file(), f"missing file: {path}"
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


@pytest.fixture(scope="module")
def manifest() -> dict:
    return _load_json(MANIFEST_PATH)


@pytest.fixture(scope="module")
def registry() -> dict:
    return _load_json(REGISTRY_PATH)


@pytest.fixture(scope="module")
def profile() -> dict:
    return _load_json(FIXTURES_DIR / "test_profile.json")


@pytest.fixture(scope="module")
def mock_ats_html() -> str:
    return MOCK_ATS_PATH.read_text(encoding="utf-8")


def _resolve_profile_path(profile: dict, dotted: str):
    node = profile
    for part in dotted.split("."):
        assert isinstance(node, dict) and part in node, (
            f"unresolved profile_path: {dotted!r}"
        )
        node = node[part]
    return node


def _selector_present(html: str, selector: str) -> bool:
    selector = selector.strip()
    if selector.startswith("#"):
        ident = selector[1:]
        return f'id="{ident}"' in html or f"id='{ident}'" in html
    m = re.fullmatch(r"\[data-test=[\"']([^\"']+)[\"']\]", selector)
    if m:
        return (
            f'data-test="{m.group(1)}"' in html or f"data-test='{m.group(1)}'" in html
        )
    m = re.fullmatch(r"input\[name=[\"']([^\"']+)[\"']\]", selector)
    if m:
        return f'name="{m.group(1)}"' in html or f"name='{m.group(1)}'" in html
    return selector in html


def _iter_keys(obj, path="$"):
    if isinstance(obj, dict):
        for key, value in obj.items():
            yield path, key
            yield from _iter_keys(value, f"{path}.{key}")
    elif isinstance(obj, list):
        for i, value in enumerate(obj):
            yield from _iter_keys(value, f"{path}[{i}]")


def _fixtures(manifest: dict) -> list:
    return manifest["fixtures"]


# --------------------------------------------------------------------------- #
# manifest
# --------------------------------------------------------------------------- #
def test_manifest_declares_frozen_header(manifest):
    assert manifest["schema"] == MANIFEST_SCHEMA
    assert re.fullmatch(r"\d+\.\d+\.\d+", manifest["manifest_version"])
    # Fixed, deterministic timestamp (no wall-clock values).
    assert manifest["generated_at"].endswith("Z")
    assert "test_profile" in manifest


def test_test_profile_is_declared_and_present(manifest, profile):
    path = FIXTURES_DIR / manifest["test_profile"]
    assert path.is_file()
    assert profile["full_name"]["first"] and profile["full_name"]["last"]


def test_platforms_are_well_formed(manifest):
    platforms = manifest["platforms"]
    assert platforms, "manifest declares no platforms"
    for name, meta in platforms.items():
        assert isinstance(name, str) and name
        assert meta["kind"] in PLATFORM_KINDS, name
        for required in ("display_name", "spec", "url_hint"):
            assert meta.get(required), f"{name}.{required} missing"


def test_fixture_ids_are_unique_and_namespaced(manifest):
    ids = [f["id"] for f in _fixtures(manifest)]
    assert len(ids) == len(set(ids)), f"duplicate fixture ids: {ids}"
    for f in _fixtures(manifest):
        assert f["id"].startswith(f["platform"] + "."), f["id"]


def test_fixture_paths_resolve_inside_fixtures_dir(manifest):
    root = FIXTURES_DIR.resolve()
    for f in _fixtures(manifest):
        rel = f["path"]
        assert "\\" not in rel, f"{f['id']}: use forward slashes only"
        assert not rel.startswith(("/", "../")), f"{f['id']}: absolute/escaping path"
        target = (FIXTURES_DIR / rel).resolve()
        assert target.is_relative_to(root), f"{f['id']}: escapes fixtures dir"
        assert target.is_file(), f"{f['id']}: missing {rel}"


def test_fixture_platforms_and_sources_are_known(manifest):
    for f in _fixtures(manifest):
        assert f["platform"] in manifest["platforms"], f["id"]
        assert f["source"] in SOURCES, f["id"]
        if f["source"] == "recorded":
            assert DATE_RE.match(str(f.get("recorded_on"))), (
                f"{f['id']}: recorded_on required"
            )
        else:
            assert f.get("recorded_on") is None, (
                f"{f['id']}: synthetic must have null recorded_on"
            )


def test_fixture_step_bounds(manifest):
    for f in _fixtures(manifest):
        assert f["total_steps"] >= 1, f["id"]
        assert 1 <= f["step_index"] <= f["total_steps"], f["id"]


def test_expected_outcome_declared(manifest):
    for f in _fixtures(manifest):
        assert f["expected"].get("outcome"), f"{f['id']}: expected.outcome missing"


# --------------------------------------------------------------------------- #
# mock ATS coverage
# --------------------------------------------------------------------------- #
def test_mock_ats_covers_three_states_on_one_file(manifest):
    mock = [f for f in _fixtures(manifest) if f["platform"] == "mock_ats"]
    states = {f["form_state"] for f in mock}
    assert states == set(MOCK_ATS_STATES), states
    for f in mock:
        assert f["path"] == "mock_ats/index.html", (
            f"{f['id']}: mock ATS is a single file"
        )
        assert f["step_index"] == MOCK_ATS_STATES[f["form_state"]], f["id"]
        assert f["total_steps"] == 3, f["id"]


# --------------------------------------------------------------------------- #
# expected field shape
# --------------------------------------------------------------------------- #
def test_expected_fields_shape(manifest):
    for f in _fixtures(manifest):
        fields = f["expected"]["fields"]
        assert isinstance(fields, list), f["id"]
        keys = [fd["key"] for fd in fields]
        assert len(keys) == len(set(keys)), f"{f['id']}: duplicate field keys"
        for fd in fields:
            assert fd["kind"] in FIELD_KINDS, (
                f"{f['id']}.{fd['key']}: kind {fd['kind']}"
            )
            assert isinstance(fd["required"], bool), f"{f['id']}.{fd['key']}"
            assert fd["selector"], f"{f['id']}.{fd['key']}: selector missing"


def test_required_fields_are_answerable(manifest):
    for f in _fixtures(manifest):
        for fd in f["expected"]["fields"]:
            if not fd["required"]:
                continue
            assert (
                "expected_value" in fd
                or fd.get("profile_path")
                or fd.get("upload_fixture")
            ), f"{f['id']}.{fd['key']}: required but no value source"


def test_choice_fields_have_consistent_options(manifest):
    for f in _fixtures(manifest):
        for fd in f["expected"]["fields"]:
            if fd["kind"] in CHOICE_KINDS:
                assert fd.get("options"), f"{f['id']}.{fd['key']}: choice needs options"
                expected = fd.get("expected_value")
                if isinstance(expected, str):
                    assert expected in fd["options"], (
                        f"{f['id']}.{fd['key']}: {expected!r}"
                    )


def test_high_stakes_fields_are_profile_backed(manifest):
    """High-stakes answers must come from the verified profile or explicit options."""
    seen = 0
    for f in _fixtures(manifest):
        for fd in f["expected"]["fields"]:
            if not fd.get("high_stakes"):
                continue
            seen += 1
            assert fd.get("profile_path") or fd.get("options"), (
                f"{f['id']}.{fd['key']}: high_stakes must be profile-backed or enumerated"
            )
    assert seen >= 3, (
        "expected the mock ATS screening step to flag work-auth/sponsorship/years"
    )


def test_upload_fixtures_exist(manifest):
    for f in _fixtures(manifest):
        for fd in f["expected"]["fields"]:
            upload = fd.get("upload_fixture")
            if not upload:
                continue
            assert fd["kind"] == "file", f"{f['id']}.{fd['key']}"
            assert (FIXTURES_DIR / upload).is_file(), (
                f"{f['id']}.{fd['key']}: missing {upload}"
            )


# --------------------------------------------------------------------------- #
# expected values vs the deterministic profile
# --------------------------------------------------------------------------- #
def test_expected_values_match_profile(manifest, profile):
    checked = 0
    for f in _fixtures(manifest):
        for fd in f["expected"]["fields"]:
            dotted = fd.get("profile_path")
            if not dotted:
                continue
            checked += 1
            assert fd["expected_value"] == _resolve_profile_path(profile, dotted), (
                f"{f['id']}.{fd['key']}: expected_value != test_profile[{dotted}]"
            )
    assert checked >= 6, "profile-backed expected values are under-specified"


def test_profile_is_deterministic_and_synthetic(profile):
    assert profile["email"].endswith("@example.com"), (
        "reserved example.com domain required"
    )
    assert not re.search(r"@(gmail|yahoo|outlook|hotmail)\.", profile["email"])
    assert "555" in profile["phone"], "use a reserved 555 test number"
    assert profile["consent"] is True
    assert profile["work_authorization"] in {
        "us_citizen",
        "us_permanent_resident",
        "us_work_visa",
        "require_sponsorship",
        "other",
    }
    assert profile["requires_sponsorship"] is False


# --------------------------------------------------------------------------- #
# mock ATS HTML
# --------------------------------------------------------------------------- #
def test_mock_ats_has_no_external_resources(mock_ats_html):
    for pattern in EXTERNAL_PATTERNS:
        assert not re.search(pattern, mock_ats_html, re.IGNORECASE), (
            f"mock ATS must be fully offline; matched /{pattern}/"
        )


def test_mock_ats_exposes_runtime_surface(mock_ats_html):
    assert "window.__MOCK_ATS__" in mock_ats_html
    assert "MOCK-ATS-2026-0001" in mock_ats_html


def test_mock_ats_step_sections(mock_ats_html):
    assert mock_ats_html.count('class="step"') == 3
    for step in (1, 2, 3):
        assert f'data-step="{step}"' in mock_ats_html


def test_mock_ats_hidden_resume_input(mock_ats_html):
    assert 'id="resume"' in mock_ats_html
    assert 'class="sr-only"' in mock_ats_html
    assert 'type="file"' in mock_ats_html


def test_mock_ats_terminal_states(mock_ats_html):
    assert 'id="confirmation"' in mock_ats_html
    assert 'data-status="SUBMITTED"' in mock_ats_html
    assert 'id="discarded"' in mock_ats_html
    assert 'data-status="DISCARDED"' in mock_ats_html


def test_every_manifest_selector_exists_in_html(manifest, mock_ats_html):
    checked = 0
    for f in _fixtures(manifest):
        if f["platform"] != "mock_ats":
            continue
        selectors = [fd["selector"] for fd in f["expected"]["fields"]]
        for key in ("next", "back"):
            if key in f["expected"]:
                selectors.append(f["expected"][key]["selector"])
        for key in ("summary", "certify", "submit", "discard"):
            block = f["expected"].get(key)
            if isinstance(block, dict) and "selector" in block:
                selectors.append(block["selector"])
        for control in f["expected"].get("terminal", {}).values():
            selectors.append(control["selector"])
        for selector in selectors:
            checked += 1
            assert _selector_present(mock_ats_html, selector), (
                f"{f['id']}: selector not found in mock ATS: {selector}"
            )
    assert checked >= 20


# --------------------------------------------------------------------------- #
# company registry
# --------------------------------------------------------------------------- #
def test_registry_header(registry):
    assert registry["company_count"] == len(registry["companies"])
    assert DATE_RE.match(registry["verified_on"])
    assert set(registry["provider_counts"]) == PROVIDERS


def test_registry_target_size(registry):
    assert 100 <= registry["company_count"] <= 500, "seed target is 100-500 companies"


def test_registry_companies_unique(registry):
    names = [c["company"] for c in registry["companies"]]
    assert len(names) == len(set(names)), "duplicate company rows"
    for name in names:
        assert isinstance(name, str) and name.strip()


def test_registry_providers_and_tokens_agree(registry):
    for c in registry["companies"]:
        providers = c["providers"]
        assert providers, f"{c['company']}: no providers"
        assert len(providers) == len(set(providers)), (
            f"{c['company']}: duplicate providers"
        )
        for p in providers:
            assert p in PROVIDERS, f"{c['company']}: unknown provider {p}"
        # token present iff provider listed — no orphan or dangling tokens
        for p, field in PROVIDER_TOKEN_FIELD.items():
            token = c.get(field)
            if p in providers:
                assert token, f"{c['company']}: provider {p} but {field} is empty"
                assert TOKEN_RE.match(token), f"{c['company']}: bad token {token!r}"
            else:
                assert token in (None, ""), (
                    f"{c['company']}: {field} set for absent provider"
                )


def test_registry_counts_count_boards(registry):
    counts = registry["provider_counts"]
    for p in PROVIDERS:
        actual = sum(1 for c in registry["companies"] if p in c["providers"])
        assert counts[p] == actual, f"{p}: provider_counts {counts[p]} != rows {actual}"
    # provider_counts counts boards, so it can exceed the company count (dual-listed).
    assert sum(counts.values()) == sum(
        len(c["providers"]) for c in registry["companies"]
    )
    assert sum(counts.values()) >= registry["company_count"]


def test_registry_rows_are_verified(registry):
    for c in registry["companies"]:
        assert c["verified"] is True, c["company"]
        assert c["verified_on"] == registry["verified_on"], c["company"]


# --------------------------------------------------------------------------- #
# hygiene: no secrets / cookies / live endpoints in fixtures
# --------------------------------------------------------------------------- #
def test_fixtures_contain_no_secret_keys():
    targets = [MANIFEST_PATH, REGISTRY_PATH, FIXTURES_DIR / "test_profile.json"]
    for path in targets:
        data = _load_json(path)
        for trace, key in _iter_keys(data):
            assert key.lower() not in FORBIDDEN_KEYS, (
                f"{path.name}: forbidden key {trace}.{key}"
            )


def test_fixtures_contain_no_secret_material(mock_ats_html):
    blobs = [mock_ats_html]
    for path in (MANIFEST_PATH, REGISTRY_PATH, FIXTURES_DIR / "test_profile.json"):
        blobs.append(path.read_text(encoding="utf-8"))
    for blob in blobs:
        assert "Set-Cookie" not in blob
        assert "Bearer " not in blob
        assert "sessionid" not in blob.lower()


def test_fixtures_readme_present():
    readme = FIXTURES_DIR / "README.md"
    assert readme.is_file()
    text = readme.read_text(encoding="utf-8")
    assert "manifest.json" in text and "company_registry.json" in text
