"""HTTP client for the Pollinations chat completion API."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Dict, Iterable, Iterator, List, Optional

import requests


@dataclass
class PollinationsClient:
    """Thin wrapper around the Pollinations chat completion endpoint."""

    api_url: str = "https://gen.pollinations.ai/v1/chat/completions"
    model: str = "gemini"
    temperature: float = 0.6
    reasoning_effort: str = "minimal"
    timeout: float = 120.0
    session: requests.Session = field(default_factory=requests.Session)

    def stream_chat_completion(
        self,
        messages: Iterable[Dict[str, str]],
        extra_payload: Optional[Dict[str, object]] = None,
    ) -> Iterator[str]:
        """Yield completion tokens as they stream in.

        The Pollinations API follows the same server-sent event shape as the OpenAI
        chat completion API. Each data line contains a JSON payload with a `choices`
        array, where each choice exposes a `delta` object with `content` chunks.
        """

        payload: Dict[str, object] = {
            "model": self.model,
            "messages": list(messages),
            "temperature": self.temperature,
            "reasoning_effort": self.reasoning_effort,
            "stream": True,
        }
        if extra_payload:
            payload.update(extra_payload)

        response = self.session.post(
            self.api_url,
            json=payload,
            stream=True,
            timeout=self.timeout,
        )
        response.raise_for_status()

        for raw_line in response.iter_lines(decode_unicode=True):
            if not raw_line:
                continue
            if not raw_line.startswith("data: "):
                continue
            data = raw_line[6:].strip()
            if data == "[DONE]":
                break
            try:
                chunk = json.loads(data)
            except json.JSONDecodeError:
                continue

            for choice in chunk.get("choices", []):
                delta = choice.get("delta", {})
                content_piece = delta.get("content")
                if content_piece:
                    yield content_piece

    def complete(
        self,
        messages: List[Dict[str, str]],
        extra_payload: Optional[Dict[str, object]] = None,
    ) -> str:
        """Return a full completion by consuming the stream."""

        return "".join(
            self.stream_chat_completion(messages=messages, extra_payload=extra_payload)
        )
