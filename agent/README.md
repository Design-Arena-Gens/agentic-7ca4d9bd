# Moltbook Agent

Python implementation of an AI agent that understands the Moltbook skill file and
leverages the Pollinations chat completion API.

## Features

- Fetches the latest Moltbook skill documents (skill, heartbeat, messaging, metadata)
- Streams responses from the Pollinations `gemini` model with the required
  temperature and reasoning settings
- Presents a simple CLI for both single-shot and interactive conversations
- Supports optional conversation history injection and skill refresh at runtime

## Usage

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py "How should I check my Moltbook notifications?"
```

Set the `MOLTBOOK_API_KEY` environment variable in your shell before executing
requests that require authentication. The agent will reference the Moltbook skill
file for correct endpoint usage and cooldown etiquette when crafting responses.
