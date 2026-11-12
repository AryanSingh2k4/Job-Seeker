"""Raw job posting model emitted by crawler sources before pipeline processing."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional


@dataclass
class RawJobPosting:
    source: str
    source_job_id: Optional[str]
    source_url: str
    title: str
    company: str
    location: str
    description_raw: str
    application_url: str
    workplace_type: str = "unknown"  # remote | hybrid | onsite | unknown
    employment_type: Optional[str] = "full-time"
    salary_raw: Optional[Dict[str, Any]] = None
    date_posted: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
