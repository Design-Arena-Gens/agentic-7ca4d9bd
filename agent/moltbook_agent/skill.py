"""Utility helpers for fetching Moltbook skill documentation."""
from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from typing import Dict, Iterable, Optional

import requests


@dataclass(frozen=True)
class SkillDocument:
    """Represents a single Moltbook skill document."""

    name: str
    url: str
    content: str


@dataclass(frozen=True)
class SkillBundle:
    """Container for all available Moltbook skill documents."""

    primary: SkillDocument
    heartbeat: Optional[SkillDocument]
    messaging: Optional[SkillDocument]
    metadata: Optional[Dict[str, object]]

    @property
    def prompt_context(self) -> str:
        """Concatenate relevant snippets for LLM conditioning."""

        sections = [f"# {self.primary.name}\n\n{self.primary.content.strip()}"]
        if self.heartbeat:
            sections.append(
                f"# {self.heartbeat.name}\n\n{self.heartbeat.content.strip()}"
            )
        if self.messaging:
            sections.append(
                f"# {self.messaging.name}\n\n{self.messaging.content.strip()}"
            )
        return "\n\n".join(sections)


class SkillRepository:
    """Downloads and caches Moltbook skill documents."""

    DEFAULT_URLS = {
        "primary": "https://www.moltbook.com/skill.md",
        "heartbeat": "https://www.moltbook.com/heartbeat.md",
        "messaging": "https://www.moltbook.com/messaging.md",
        "metadata": "https://www.moltbook.com/skill.json",
    }

    def __init__(self, session: Optional[requests.Session] = None) -> None:
        self._session = session or requests.Session()

    def _fetch_text(self, url: str) -> str:
        response = self._session.get(url, timeout=30)
        response.raise_for_status()
        return response.text

    def _fetch_json(self, url: str) -> Dict[str, object]:
        response = self._session.get(url, timeout=30)
        response.raise_for_status()
        return response.json()

    @lru_cache(maxsize=1)
    def load(self) -> SkillBundle:
        primary = SkillDocument(
            name="Moltbook Skill",
            url=self.DEFAULT_URLS["primary"],
            content=self._fetch_text(self.DEFAULT_URLS["primary"]),
        )
        heartbeat = SkillDocument(
            name="Moltbook Heartbeat",
            url=self.DEFAULT_URLS["heartbeat"],
            content=self._fetch_text(self.DEFAULT_URLS["heartbeat"]),
        )
        messaging = SkillDocument(
            name="Moltbook Messaging",
            url=self.DEFAULT_URLS["messaging"],
            content=self._fetch_text(self.DEFAULT_URLS["messaging"]),
        )
        try:
            metadata = self._fetch_json(self.DEFAULT_URLS["metadata"])
        except (requests.HTTPError, json.JSONDecodeError):
            metadata = None

        return SkillBundle(
            primary=primary,
            heartbeat=heartbeat,
            messaging=messaging,
            metadata=metadata,
        )

    def refresh(self) -> SkillBundle:
        """Invalidate cache and reload documents."""

        self.load.cache_clear()  # type: ignore[attr-defined]
        return self.load()
