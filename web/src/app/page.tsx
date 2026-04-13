"use client";

import { useCallback, useState } from "react";
import type { FocusEvent } from "react";

const SAMPLE_QUERIES = [
  "Where is the auth token generated?",
  "What environment variables are required for authentication?",
  "How do I connect to the database?",
  "Which endpoint lists all users?",
  "What does the /api/projects/<project_id> route return?",
  "Is there any mention of payment processing in these docs?",
  "How does a client refresh an access token?",
  "Which fields are stored in the users table?",
];

interface Snippet {
  filename: string;
  text: string;
  score: number;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [refusal, setRefusal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSampleQueriesOpen, setIsSampleQueriesOpen] = useState(false);

  function closeSampleQueriesIfLeaving(field: FocusEvent<HTMLDivElement>) {
    const next = field.relatedTarget as Node | null;
    if (!next || !field.currentTarget.contains(next)) {
      setIsSampleQueriesOpen(false);
    }
  }

  const runRetrieve = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed, topK: 5 }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        if (response.status === 429) {
          setError(payload?.error ?? "Too many requests. Please try again later.");
        } else {
          setError(payload?.error ?? `Request failed (${response.status})`);
        }
        setSnippets([]);
        setRefusal(false);
        return;
      }
      const data = (await response.json()) as { snippets: Snippet[]; refusal: boolean };
      setSnippets(data.snippets);
      setRefusal(Boolean(data.refusal));
    } catch {
      setError("Network error. Is the dev server running?");
      setSnippets([]);
      setRefusal(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">DocuBot Web</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Retrieval-only (M1) — answers are passages from the bundled docs with scores.
            </p>
          </div>
          <a
            className="text-sm font-medium text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
            href="/api/health"
            target="_blank"
            rel="noreferrer"
          >
            Health check
          </a>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-6 py-8 lg:grid-cols-[1fr_340px]">
        <section className="space-y-4">
          <label className="block text-sm font-medium" htmlFor="query">
            Your question
          </label>
          <div className="relative" onBlur={closeSampleQueriesIfLeaving}>
            <textarea
              id="query"
              rows={3}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsSampleQueriesOpen(true)}
              onClick={() => setIsSampleQueriesOpen(true)}
              placeholder="Click here, then pick a sample query or type your own…"
              className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm outline-none ring-blue-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
              aria-expanded={isSampleQueriesOpen}
              aria-controls="sample-queries-list"
            />
            {isSampleQueriesOpen ? (
              <div
                id="sample-queries-list"
                className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                role="listbox"
                aria-label="Sample queries"
              >
                <p className="px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Sample queries
                </p>
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {SAMPLE_QUERIES.map((sample) => (
                    <li key={sample}>
                      <button
                        type="button"
                        role="option"
                        className="w-full px-2.5 py-1.5 text-left text-xs leading-snug text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setQuery(sample);
                          setIsSampleQueriesOpen(false);
                          void runRetrieve(sample);
                        }}
                      >
                        {sample}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runRetrieve(query)}
              disabled={isLoading || !query.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Searching…" : "Search docs"}
            </button>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSnippets([]);
                setRefusal(false);
                setError(null);
              }}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Clear
            </button>
          </div>
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {error}
            </p>
          ) : null}
          {refusal && !error ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
              I do not know based on these docs.
            </p>
          ) : null}
        </section>

        <aside className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:sticky lg:top-8 lg:self-start">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Sources</h2>
          {snippets.length === 0 && !isLoading && !refusal && !error ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Run a search to see ranked snippets.</p>
          ) : null}
          {isLoading ? <p className="text-sm text-zinc-500">Loading snippets…</p> : null}
          <ol className="space-y-4">
            {snippets.map((s, idx) => (
              <li key={`${s.filename}-${idx}`} className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                    {s.filename}
                  </span>
                  <span className="text-xs text-zinc-500">score {s.score}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
                  {s.text}
                </p>
              </li>
            ))}
          </ol>
        </aside>
      </main>
    </div>
  );
}
