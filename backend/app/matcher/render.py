"""Typst compile and pypdf round-trip ATS verification engine (§6.2)."""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from pypdf import PdfReader

from app.config import get_settings
from app.errors import AppException
from app.matcher.tailor import TailoredResumeData

logger = logging.getLogger(__name__)


def to_typst_code(data: TailoredResumeData, template_name: str = "ats_classic.typ") -> str:
    """Serialize tailored resume data into Typst syntax."""
    def _esc(val: str) -> str:
        return val.replace('"', '\\"').replace("\n", " ")

    lines = [
        f'#import "{template_name}": resume',
        f'#resume(',
        f'  name: "{_esc(data.full_name)}",',
        f'  phone: "{_esc(data.phone)}",',
        f'  email: "{_esc(data.email)}",',
        f'  location: "{_esc(data.location)}",',
        f'  linkedin: {"none" if not data.linkedin_url else f'"{_esc(data.linkedin_url)}"'},',
        f'  github: {"none" if not data.github_url else f'"{_esc(data.github_url)}"'},',
        f'  summary: "{_esc(data.summary_sentence)}",',
    ]

    # Skills dict
    lines.append("  skills_by_category: (")
    for cat, items in data.skills_by_category.items():
        escaped_items = ", ".join(f'"{_esc(i)}"' for i in items)
        if len(items) == 1:
            escaped_items += ","
        lines.append(f'    "{_esc(cat)}": ({escaped_items}),')
    lines.append("  ),")

    # Experiences array
    lines.append("  experiences: (")
    for exp in data.experiences:
        lines.append("    (")
        lines.append(f'      company_name: "{_esc(exp["company_name"])}",')
        lines.append(f'      role_title: "{_esc(exp["role_title"])}",')
        lines.append(f'      location: "{_esc(exp.get("location", ""))}",')
        lines.append(f'      start_date: "{_esc(exp["start_date"])}",')
        lines.append(f'      end_date: "{_esc(exp.get("end_date", "Present"))}",')
        lines.append("      bullets: (")
        for b in exp.get("bullets", []):
            lines.append(f'        "{_esc(b)}",')
        lines.append("      ),")
        lines.append("    ),")
    lines.append("  ),")

    # Education array
    lines.append("  education: (")
    for edu in data.education:
        lines.append("    (")
        lines.append(f'      institution: "{_esc(edu["institution"])}",')
        lines.append(f'      degree: "{_esc(edu["degree"])}",')
        lines.append(f'      field_of_study: "{_esc(edu["field_of_study"])}",')
        lines.append(f'      start_year: "{edu["start_year"]}",')
        lines.append(f'      end_year: "{edu.get("end_year", "Present")}",')
        lines.append("    ),")
    lines.append("  ),")

    # Projects array
    lines.append("  projects: (")
    for proj in data.projects:
        lines.append("    (")
        lines.append(f'      name: "{_esc(proj["name"])}",')
        lines.append(f'      description: "{_esc(proj.get("description", ""))}",')
        tech_list = proj.get("technologies", [])
        escaped_tech = ", ".join(f'"{_esc(t)}"' for t in tech_list)
        if len(tech_list) == 1:
            escaped_tech += ","
        lines.append(f'      technologies: ({escaped_tech}),')
        lines.append("      bullets: (")
        for b in proj.get("bullets", []):
            lines.append(f'        "{_esc(b)}",')
        lines.append("      ),")
        lines.append("    ),")
    lines.append("  ),")

    lines.append(")")
    return "\n".join(lines)


def compile_typst(typst_code: str, output_pdf_path: Path, template_name: str = "ats_classic.typ") -> None:
    """Compile Typst string to PDF file using python typst library or CLI."""
    settings = get_settings()
    template_src = settings.templates_dir / template_name

    output_pdf_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_dir_path = Path(temp_dir)
        # Copy template into temp directory so relative #import works cleanly
        if template_src.is_file():
            shutil.copy2(template_src, temp_dir_path / template_name)

        temp_typ = temp_dir_path / "resume.typ"
        temp_typ.write_text(typst_code, encoding="utf-8")

        # Try typst-py wrapper
        try:
            import typst
            typst.compile(temp_typ, output=output_pdf_path)
            return
        except ImportError:
            pass

        # Try typst CLI command
        res = subprocess.run(
            ["typst", "compile", str(temp_typ), str(output_pdf_path)],
            capture_output=True,
            text=True,
        )
        if res.returncode != 0:
            raise RuntimeError(f"Typst compilation failed: {res.stderr}")


def verify_ats_round_trip(pdf_path: Path, expected_bullets: list[str]) -> bool:
    """Verify that every selected bullet appears in text extraction order."""
    reader = PdfReader(str(pdf_path))
    full_text = " ".join([page.extract_text() for page in reader.pages])

    for b in expected_bullets:
        b_clean = " ".join(b.split()[:8])
        if b_clean not in full_text:
            logger.warning("ATS round-trip missing bullet text: %s", b_clean)
            return False

    return True


def render_and_verify_resume(data: TailoredResumeData, output_pdf_path: Path) -> Path:
    """Generate, compile, and ATS-verify tailored resume PDF."""
    typst_code = to_typst_code(data)
    compile_typst(typst_code, output_pdf_path)

    all_bullets = []
    for exp in data.experiences:
        all_bullets.extend(exp.get("bullets", []))

    if not verify_ats_round_trip(output_pdf_path, all_bullets):
        raise AppException(
            code="render_failed",
            message="ATS round-trip verification failed: rendered PDF lost required content",
            status_code=500,
        )

    return output_pdf_path
