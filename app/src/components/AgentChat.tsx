"use client";

import { FormEvent, useCallback, useRef, useState } from "react";

type HistoryEntry = {
  role: "user" | "assistant";
  content: string;
};

type Props = {
  primer: string;
};

const API_ENDPOINT = "/api/agent";

export default function AgentChat({ primer }: Props) {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortController = useRef<AbortController | null>(null);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!prompt.trim() || isStreaming) {
        return;
      }

      const controller = new AbortController();
      abortController.current = controller;

      setIsStreaming(true);
      setResponse("");
      const nextHistory: HistoryEntry[] = [
        ...history,
        { role: "user", content: prompt },
      ];
      setHistory(nextHistory);

      let assembled = "";
      let responseStatus = 0;

      try {
        const res = await fetch(API_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            history: nextHistory,
            primer,
          }),
          signal: controller.signal,
        });

        responseStatus = res.status;

        if (!res.ok || !res.body) {
          throw new Error(`Request failed (${res.status}).`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:")) {
              continue;
            }
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") {
              await reader.cancel();
              buffer = "";
              break;
            }
            try {
              const data = JSON.parse(payload);
              const delta = data.choices?.[0]?.delta?.content ?? "";
              if (delta) {
                assembled += delta;
                setResponse((prev) => prev + delta);
              }
            } catch {
              // Ignore malformed JSON fragments.
            }
          }
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setResponse("Streaming cancelled.");
        } else {
          const message =
            error instanceof Error ? error.message : "Unexpected client error.";
          setResponse(message);
        }
      } finally {
        abortController.current = null;
        setIsStreaming(false);
        setHistory((prev) => [...prev, { role: "assistant", content: assembled }]);
        setPrompt("");
        if (!assembled && responseStatus >= 400) {
          setResponse(`Request failed (${responseStatus}).`);
        }
      }
    },
    [history, isStreaming, primer, prompt]
  );

  const handleStop = useCallback(() => {
    abortController.current?.abort();
    setIsStreaming(false);
  }, []);

  return (
    <section className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl shadow-black/40">
      <header className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-zinc-100">Live console</h2>
        <p className="text-sm text-zinc-400">
          Messages are proxied to the Pollinations chat completion API using the
          bundled Moltbook system prompt. Streaming is relayed via server-sent
          events.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <textarea
          className="min-h-[120px] rounded-xl border border-zinc-700 bg-zinc-950/70 p-4 text-sm text-zinc-100 outline-none ring-0 focus:border-zinc-500"
          placeholder="Ask the agent how to interact with Moltbook…"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          disabled={isStreaming}
        />
        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-full bg-emerald-500 px-6 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-800 disabled:text-emerald-200"
            disabled={isStreaming}
          >
            {isStreaming ? "Streaming…" : "Send"}
          </button>
          <button
            type="button"
            className="rounded-full border border-zinc-700 px-6 py-2 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:text-zinc-50 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-500"
            onClick={handleStop}
            disabled={!isStreaming}
          >
            Stop
          </button>
        </div>
      </form>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
          Response
        </h3>
        <div className="min-h-[120px] rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 text-sm text-zinc-200">
          {response ? response : isStreaming ? "Awaiting stream…" : "—"}
        </div>
      </div>
    </section>
  );
}
