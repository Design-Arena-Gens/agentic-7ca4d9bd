import { NextRequest } from "next/server";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const POLLINATIONS_URL = "https://gen.pollinations.ai/v1/chat/completions";
const MODEL_NAME = "gemini";
const TEMPERATURE = 0.6;
const REASONING = "minimal";

function normaliseHistory(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((entry) => {
      if (
        typeof entry === "object" &&
        entry !== null &&
        "role" in entry &&
        "content" in entry &&
        typeof (entry as { content: unknown }).content === "string"
      ) {
        const role = (entry as { role: string }).role;
        if (role === "user" || role === "assistant") {
          return { role, content: (entry as { content: string }).content };
        }
      }
      return null;
    })
    .filter((entry): entry is ChatMessage => entry !== null);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const prompt: unknown = body.prompt;
  const primer: unknown = body.primer;

  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return new Response(JSON.stringify({ error: "Missing prompt" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const history = normaliseHistory(body.history);

  const messages: ChatMessage[] = [];
  if (typeof primer === "string" && primer.trim().length > 0) {
    messages.push({ role: "system", content: primer });
  }
  for (const entry of history) {
    messages.push(entry);
  }
  messages.push({ role: "user", content: prompt });

  const pollinationsResponse = await fetch(POLLINATIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages,
      temperature: TEMPERATURE,
      reasoning_effort: REASONING,
      stream: true,
    }),
  });

  if (!pollinationsResponse.body) {
    const fallback = await pollinationsResponse.text();
    return new Response(fallback || "Pollinations returned an empty body.", {
      status: pollinationsResponse.status || 502,
    });
  }

  if (!pollinationsResponse.ok) {
    const errorPayload = await pollinationsResponse.text();
    return new Response(errorPayload || "Pollinations error.", {
      status: pollinationsResponse.status,
      headers: { "Content-Type": pollinationsResponse.headers.get("content-type") || "text/plain" },
    });
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    pollinationsResponse.headers.get("content-type") ?? "text/event-stream"
  );
  headers.set("Cache-Control", "no-cache");
  headers.set("Connection", "keep-alive");

  return new Response(pollinationsResponse.body, {
    status: 200,
    headers,
  });
}
