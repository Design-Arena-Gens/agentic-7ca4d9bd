import AgentChat from "@/components/AgentChat";
import Link from "next/link";

const SKILL_URLS = {
  skill: "https://www.moltbook.com/skill.md",
  heartbeat: "https://www.moltbook.com/heartbeat.md",
  messaging: "https://www.moltbook.com/messaging.md",
};

export const revalidate = 1800;

async function fetchDocument(url: string) {
  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  return res.text();
}

function trimForPrimer(input: string, maxLength = 4800) {
  if (input.length <= maxLength) {
    return input;
  }
  return `${input.slice(0, maxLength)}\n\n… (truncated)`;
}

function makePrimer(skill: string, heartbeat: string, messaging: string) {
  const body = [
    "You are the Moltbook operations agent.",
    "Use the following documentation to plan safe, policy-compliant actions.",
    "Respect cooldown windows and security warnings. Provide concrete API steps when asked.",
    "\n---\n",
    "# Moltbook Skill\n",
    trimForPrimer(skill),
    "\n---\n# Moltbook Heartbeat\n",
    trimForPrimer(heartbeat, 1600),
    "\n---\n# Moltbook Messaging\n",
    trimForPrimer(messaging, 1600),
  ];
  return body.join("\n");
}

function pullSummaryLines(doc: string, maxLines = 12) {
  return doc
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .slice(0, maxLines)
    .join("\n");
}

export default async function Home() {
  const [skill, heartbeat, messaging] = await Promise.all([
    fetchDocument(SKILL_URLS.skill),
    fetchDocument(SKILL_URLS.heartbeat),
    fetchDocument(SKILL_URLS.messaging),
  ]);

  const primer = makePrimer(skill, heartbeat, messaging);
  const heroSummary = pullSummaryLines(skill, 8);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-6 py-16">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-[0.4em] text-zinc-400">Moltbook Agent</p>
        <h1 className="text-4xl font-semibold text-zinc-50 sm:text-5xl">
          Operate Moltbook with a Pollinations-powered guide.
        </h1>
        <p className="max-w-3xl text-lg text-zinc-300">
          The Python agent (bundled in this project) fetches live Moltbook skill
          files and streams completions from Pollinations. Use the web console
          below to experiment with the same system prompt, then run
          <code className="ml-2 rounded bg-zinc-800 px-2 py-1 text-sm text-zinc-200">
            python agent/main.py
          </code>{" "}
          locally for full command-line control.
        </p>
      </header>

      <section className="grid gap-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 shadow-lg shadow-black/30 sm:grid-cols-3">
        <div className="space-y-3 sm:col-span-2">
          <h2 className="text-xl font-medium text-zinc-100">Skill quicklook</h2>
          <pre className="max-h-60 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-200">
            {heroSummary}
          </pre>
          <div className="flex flex-wrap gap-3 text-sm text-zinc-400">
            <Link
              className="underline decoration-zinc-600 hover:text-zinc-200"
              href={SKILL_URLS.skill}
              target="_blank"
            >
              SKILL.md
            </Link>
            <Link
              className="underline decoration-zinc-600 hover:text-zinc-200"
              href={SKILL_URLS.heartbeat}
              target="_blank"
            >
              HEARTBEAT.md
            </Link>
            <Link
              className="underline decoration-zinc-600 hover:text-zinc-200"
              href={SKILL_URLS.messaging}
              target="_blank"
            >
              MESSAGING.md
            </Link>
          </div>
        </div>
        <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
          <h3 className="text-lg font-medium text-zinc-100">CLI snippet</h3>
          <pre className="overflow-x-auto text-sm text-zinc-300">
            {`cd agent
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py "Draft a welcome post."`}
          </pre>
        </div>
      </section>

      <AgentChat primer={primer} />
    </main>
  );
}
