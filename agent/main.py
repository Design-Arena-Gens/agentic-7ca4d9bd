"""Command-line entry point for the Moltbook agent."""
from __future__ import annotations

import argparse
import json
import sys
from typing import Iterable, List

from moltbook_agent import ConversationTurn, MoltbookAgent, PollinationsClient, SkillRepository


def _parse_history(raw_history: str) -> List[ConversationTurn]:
    turns = json.loads(raw_history)
    if not isinstance(turns, list):
        raise ValueError("history must be a JSON array of objects")
    parsed: List[ConversationTurn] = []
    for item in turns:
        if not isinstance(item, dict):
            raise ValueError("each history entry must be an object")
        role = item.get("role")
        content = item.get("content")
        if role not in {"user", "assistant"}:
            raise ValueError("role must be either 'user' or 'assistant'")
        if not isinstance(content, str):
            raise ValueError("content must be a string")
        parsed.append(ConversationTurn(role=role, content=content))
    return parsed


def _stream_to_stdout(generator: Iterable[str]) -> None:
    for chunk in generator:
        sys.stdout.write(chunk)
        sys.stdout.flush()
    sys.stdout.write("\n")
    sys.stdout.flush()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Interact with the Moltbook agent")
    parser.add_argument("prompt", nargs="?", help="Single-shot prompt to send to the agent")
    parser.add_argument(
        "--history",
        help="Conversation history as JSON array of {role, content}",
    )
    parser.add_argument(
        "--refresh-skills",
        action="store_true",
        help="Force-refresh the remote skill documents before running",
    )
    parser.add_argument(
        "--no-stream",
        action="store_true",
        help="Disable streaming output and print the final response only",
    )
    parser.add_argument(
        "--profile",
        help="Override the default system profile prompt",
    )
    return parser


def main(argv: List[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    pollinations = PollinationsClient()
    skill_repo = SkillRepository()
    agent = MoltbookAgent(pollinations=pollinations, skill_repo=skill_repo, profile=args.profile)

    if args.refresh_skills:
        agent.refresh_skills()

    history = _parse_history(args.history) if args.history else None

    if args.prompt:
        if args.no_stream:
            result = agent.generate_reply(user_prompt=args.prompt, history=history)
            print(result)
        else:
            _stream_to_stdout(
                agent.stream_reply(user_prompt=args.prompt, history=history)
            )
        return 0

    # Interactive loop
    print("Entering interactive mode. Type '/exit' to quit, '/refresh' to reload skills.")
    local_history: List[ConversationTurn] = history[:] if history else []
    while True:
        try:
            user_input = input("you> ").strip()
        except EOFError:
            break
        if not user_input:
            continue
        if user_input == "/exit":
            break
        if user_input == "/refresh":
            agent.refresh_skills()
            print("[skills reloaded]")
            continue

        local_history.append(ConversationTurn(role="user", content=user_input))
        print("agent>", end=" ", flush=True)
        response_chunks = []
        for chunk in agent.stream_reply(user_prompt=user_input, history=local_history[:-1]):
            response_chunks.append(chunk)
            sys.stdout.write(chunk)
            sys.stdout.flush()
        sys.stdout.write("\n")
        sys.stdout.flush()
        local_history.append(ConversationTurn(role="assistant", content="".join(response_chunks)))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
