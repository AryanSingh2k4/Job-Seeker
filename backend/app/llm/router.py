"""Cheap-first LLM router with budget tracking for JobSeeker (§6.4)."""

from __future__ import annotations

import json
import logging
import os
from enum import Enum
from typing import Any, Dict, List, Optional, Type, TypeVar
from pydantic import BaseModel

from app.config import get_settings
from app.errors import AppException
from app.secrets import get_secret

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


class TaskKind(str, Enum):
    EXTRACTION = "extraction"
    MATCH_JUDGE = "match_judge"
    TAILORING = "tailoring"
    COVER_LETTER = "cover_letter"
    QA_ANSWER = "qa_answer"


async def complete(
    task: TaskKind,
    messages: List[Dict[str, str]],
    response_schema: Optional[Type[T]] = None,
) -> Optional[T]:
    """Route LLM completion through configured provider with schema validation."""
    api_key = get_secret("LLM_API_KEY") or os.environ.get("OPENAI_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        logger.debug("LLM not configured (missing key)")
        return None

    settings = get_settings()
    model = settings.llm_model_strong if task in {TaskKind.TAILORING, TaskKind.COVER_LETTER} else settings.llm_model

    try:
        import litellm
        litellm.api_key = api_key
        # Call completion
        response = await litellm.acompletion(
            model=model,
            messages=messages,
            response_format={"type": "json_object"} if response_schema else None,
            temperature=0.1,
            max_tokens=1500,
        )
        content = response.choices[0].message.content
        if response_schema and content:
            parsed_json = json.loads(content)
            return response_schema.model_validate(parsed_json)
        return content
    except Exception as exc:
        logger.warning("LLM call failed for task %s: %s", task, exc)
        return None
