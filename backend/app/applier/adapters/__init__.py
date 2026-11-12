"""ATS Adapters package (§4)."""

from __future__ import annotations

from app.applier.adapters.ashby import AshbyAdapter
from app.applier.adapters.base import ApplicationSubmissionResult, BaseAdapter
from app.applier.adapters.greenhouse import GreenhouseAdapter
from app.applier.adapters.lever import LeverAdapter
from app.applier.adapters.linkedin import LinkedInAdapter
from app.applier.adapters.mock_ats import MockATSAdapter
from app.applier.adapters.workday import WorkdayAdapter

ADAPTERS: list[BaseAdapter] = [
    MockATSAdapter(),
    LinkedInAdapter(),
    GreenhouseAdapter(),
    LeverAdapter(),
    AshbyAdapter(),
    WorkdayAdapter(),
]


def get_adapter_for_url(url: str, html: str = "") -> BaseAdapter:
    """Find the first adapter capable of handling the target application URL or DOM."""
    for adapter in ADAPTERS:
        if adapter.can_handle(url, html):
            return adapter
    return MockATSAdapter()
