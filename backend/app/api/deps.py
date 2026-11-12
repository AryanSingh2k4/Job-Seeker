"""API dependencies and common helpers for JobSeeker."""

from __future__ import annotations

from typing import Generator
from fastapi import Query
from sqlalchemy.orm import Session
from app.db import get_db, SessionLocal


class PaginationParams:
    def __init__(
        self,
        page: int = Query(1, ge=1, description="Page number"),
        page_size: int = Query(50, ge=1, le=100, description="Page size"),
    ) -> None:
        self.page = page
        self.page_size = page_size
        self.offset = (page - 1) * page_size
