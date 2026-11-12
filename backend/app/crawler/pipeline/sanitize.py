"""HTML sanitization and prompt injection defense (§6.1)."""

from __future__ import annotations

import html
import re

ZERO_WIDTH_CHARS = re.compile(r"[\u200b\u200c\u200d\u200e\u200f\ufeff\u00ad]")
HIDDEN_ELEMENTS = re.compile(r"<[^>]+style=[\"'][^\"']*(display:\s*none|visibility:\s*hidden|font-size:\s*0)[^\"']*[\"'][^>]*>.*?</[^>]+>", re.IGNORECASE | re.DOTALL)
SCRIPT_STYLE_TAGS = re.compile(r"<(script|style|svg|noscript)\b[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL)
HTML_TAGS = re.compile(r"<[^>]+>")


def sanitize_job_description(raw_html_or_text: str) -> str:
    """Strip hidden text, zero-width chars, and prompt injections. Return clean text."""
    if not raw_html_or_text:
        return ""

    # 1. Strip zero-width characters
    cleaned = ZERO_WIDTH_CHARS.sub("", raw_html_or_text)

    # 2. Drop hidden DOM elements commonly used for prompt injection
    cleaned = HIDDEN_ELEMENTS.sub("", cleaned)

    # 3. Drop scripts, styles, etc.
    cleaned = SCRIPT_STYLE_TAGS.sub("", cleaned)

    # 4. Convert breaks and paragraphs to newlines
    cleaned = re.sub(r"<(br|p|div|li|h[1-6])\b[^>]*>", "\n", cleaned, flags=re.IGNORECASE)

    # 5. Strip all remaining HTML tags
    cleaned = HTML_TAGS.sub(" ", cleaned)

    # 6. Unescape HTML entities
    cleaned = html.unescape(cleaned)

    # 7. Normalize spaces and multiple newlines
    lines = [line.strip() for line in cleaned.splitlines()]
    clean_lines = [line for line in lines if line]
    result = "\n".join(clean_lines)

    return result


def wrap_for_llm(sanitized_text: str) -> str:
    """Wrap job description in structured delimiters for safe LLM consumption."""
    return f"<job_description>\n{sanitized_text}\n</job_description>"
