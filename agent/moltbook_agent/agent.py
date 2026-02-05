"""High-level interface for calling the Pollinations model with Moltbook context."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Generator, Iterable, List, Literal, Optional

from .client import PollinationsClient
from .skill import SkillBundle, SkillRepository

Role = Literal["system", "user", "assistant"]


@dataclass
class ConversationTurn:
    """Represents a single turn in the conversation history."""

    role: Role
    content: str


class MoltbookAgent:
    """Wraps the Pollinations client with Moltbook-specific prompting."""

    def __init__(
        self,
        pollinations: PollinationsClient,
        skill_repo: Optional[SkillRepository] = None,
        profile: Optional[str] = None,
    ) -> None:
        self._pollinations = pollinations
        self._skill_repo = skill_repo or SkillRepository()
        self._skill_bundle = self._skill_repo.load()
        self._profile = profile or (
            "You are an autonomous assistant that helps maintain a Moltbook agent."
        )

    @property
    def skill_bundle(self) -> SkillBundle:
        return self._skill_bundle

    def refresh_skills(self) -> SkillBundle:
        self._skill_bundle = self._skill_repo.refresh()
        return self._skill_bundle

    def _build_system_prompt(self) -> str:
        metadata = self._skill_bundle.metadata or {}
        meta_summary = (
            f"Skill metadata: {metadata}" if metadata else "Skill metadata unavailable."
        )
        return (
            f"{self._profile}\n\n"
            "Follow the Moltbook interaction contract described in the provided"
            " skill documents. Always respect cooldown limits, security warnings,"
            " and heartbeat guidance. When crafting API requests, use the exact"
            " endpoints and HTTP methods from the docs. If you need to post or"
            " comment, ensure the action is justified and mention any required"
            " cooldown management."
            f"\n\n{meta_summary}\n\n{self._skill_bundle.prompt_context}"
        )

    def _build_message_stack(
        self,
        user_prompt: str,
        history: Optional[Iterable[ConversationTurn]] = None,
    ) -> List[dict]:
        messages: List[dict] = [{"role": "system", "content": self._build_system_prompt()}]
        if history:
            for turn in history:
                if turn.role == "system":
                    # Avoid duplicating system prompts from history; use latest only.
                    continue
                messages.append({"role": turn.role, "content": turn.content})
        messages.append({"role": "user", "content": user_prompt})
        return messages

    def stream_reply(
        self,
        user_prompt: str,
        history: Optional[Iterable[ConversationTurn]] = None,
        extra_payload: Optional[dict] = None,
    ) -> Generator[str, None, None]:
        """Stream a reply from the Pollinations model."""

        messages = self._build_message_stack(user_prompt=user_prompt, history=history)
        yield from self._pollinations.stream_chat_completion(
            messages=messages, extra_payload=extra_payload
        )

    def generate_reply(
        self,
        user_prompt: str,
        history: Optional[Iterable[ConversationTurn]] = None,
        extra_payload: Optional[dict] = None,
    ) -> str:
        """Return the full reply."""

        return self._pollinations.complete(
            messages=self._build_message_stack(user_prompt, history),
            extra_payload=extra_payload,
        )
