"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ManifestoHeader } from "@/components/ManifestoHeader";
import { SpinningManifold } from "@/components/SpinningManifold";
import { StepDots } from "@/components/StepDots";
import { saveProfileDraft } from "@/lib/profile-storage";

type SourceRow = { url: string; ok: boolean; chars?: number; error?: string };

export default function Home() {
  const router = useRouter();
  const [urlsText, setUrlsText] = useState("");
  const [chunks, setChunks] = useState<string[]>([""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<SourceRow[] | null>(null);

  const setChunk = useCallback((i: number, value: string) => {
    setChunks((c) => c.map((x, j) => (j === i ? value : x)));
  }, []);

  const addChunk = useCallback(() => {
    setChunks((c) => [...c, ""]);
  }, []);

  const removeChunk = useCallback((i: number) => {
    setChunks((c) => (c.length <= 1 ? c : c.filter((_, j) => j !== i)));
  }, []);

  const onFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = e.target;
    if (!files?.length) return;
    const parts: string[] = [];
    for (const f of files) {
      if (f.size > 512 * 1024) continue;
      const t = await f.text();
      if (t.trim()) parts.push(t.trim());
    }
    if (parts.length) setChunks((c) => [...c.filter(Boolean), ...parts, ""]);
    e.target.value = "";
  }, []);

  const submit = async () => {
    setError(null);
    setSources(null);
    const urls = urlsText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const samples = chunks.map((s) => s.trim()).filter(Boolean);
    if (urls.length === 0 && samples.length === 0) {
      setError(
        "Add at least one link, or paste text in the optional box below.",
      );
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/profile-from-samples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, samples }),
      });
      let data: Record<string, unknown> = {};
      const raw = await res.text();
      try {
        data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      } catch {
        setError(
          `Server returned HTTP ${res.status} with a non-JSON body. Is the dev server running?`,
        );
        return;
      }
      if (!res.ok) {
        if (Array.isArray(data.sources)) {
          setSources(data.sources as SourceRow[]);
        }
        setError(
          typeof data.error === "string"
            ? data.error
            : res.statusText || "Request failed",
        );
        return;
      }
      setSources(null);
      const doc = typeof data.document === "string" ? data.document : "";
      if (!doc) {
        setError("Empty response.");
        return;
      }
      saveProfileDraft(doc);
      router.push("/calibrate");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full">
      <main className="mx-auto max-w-2xl px-5 py-14 sm:px-8 sm:py-16">
        <StepDots active={0} />
        <ManifestoHeader
          graphic={<SpinningManifold />}
          title="Your voice, one file"
          subtitle="Paste public links to things you have already published. We pull the visible text, draft a tight spec, show you lines to approve or reject, then hand you one file—plain text you own."
        />

        <aside className="mt-10 border border-[var(--rule)] bg-[var(--paper-2)] p-4 text-left text-[0.8125rem] leading-relaxed text-[var(--ink-muted)]">
          <p className="font-doc-mono text-[10px] uppercase tracking-widest text-[var(--ink)]">
            What you walk away with
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>A first-pass spec from your links (and any paste).</li>
            <li>A screen of candidate lines—say which ones match you.</li>
            <li>One file you can file, edit, or feed to any tool on your terms.</li>
          </ul>
        </aside>

        <section className="mt-10 space-y-3 border border-[var(--rule)] bg-[var(--paper)] p-5 sm:p-6">
          <h2 className="font-doc-mono text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--ink)]">
            Step 1 · Links
          </h2>
          <p className="text-[0.9375rem] leading-relaxed text-[var(--ink-muted)]">
            Put one URL per line: profile pages, pinned posts, blog indexes,
            newsletter archives—anything that is <strong>public</strong> and
            opens without signing in. We fetch the text from each page. Many
            networks limit bots; if a link fails, use another page or paste an
            excerpt in step 2.
          </p>
          <textarea
            className="type-input min-h-[120px] w-full resize-y border border-[var(--rule)] bg-[var(--paper)] px-3 py-2.5 text-[0.875rem] leading-relaxed text-[var(--ink)] outline-none ring-0 focus:border-[var(--rule-strong)]"
            placeholder={"https://\nhttps://"}
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
            spellCheck={false}
          />
        </section>

        <section className="mt-6 space-y-3 border border-[var(--rule)] bg-[var(--paper)] p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <h2 className="font-doc-mono text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--ink)]">
                Step 2 · Optional paste
              </h2>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-[var(--ink-muted)]">
                If a site blocked the fetch, or you want more material, paste
                drafts, emails, or notes here. Plain text or Markdown is fine.
              </p>
            </div>
            <label className="shrink-0 cursor-pointer border border-[var(--rule)] bg-[var(--paper-2)] px-3 py-2 text-center font-doc-mono text-[11px] uppercase tracking-wider text-[var(--ink)] hover:border-[var(--rule-strong)]">
              Upload .txt / .md
              <input
                type="file"
                accept=".txt,.text,.md,.markdown"
                multiple
                className="sr-only"
                onChange={(e) => void onFiles(e)}
              />
            </label>
          </div>

          <div className="space-y-3">
            {chunks.map((text, i) => (
              <div key={i}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-doc-mono text-[10px] uppercase tracking-wider text-[var(--ink-muted)]">
                    Block {i + 1}
                  </span>
                  {chunks.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeChunk(i)}
                      className="font-doc-mono text-[10px] uppercase tracking-wider text-[var(--ink-muted)] hover:text-[var(--ink)]"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setChunk(i, e.target.value)}
                  rows={5}
                  placeholder="Paste here…"
                  className="type-input w-full resize-y border border-[var(--rule)] bg-[var(--paper)] px-3 py-2.5 text-[0.875rem] leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--rule-strong)]"
                  spellCheck
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addChunk}
            className="font-doc-mono text-[11px] uppercase tracking-wider text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            + Another block
          </button>
        </section>

        {sources?.length ? (
          <ul className="mt-6 space-y-1 font-doc-mono text-[11px] text-[var(--ink-muted)]">
            {sources.map((s) => (
              <li key={s.url}>
                {s.ok ? "ok" : "fail"} · {s.url}
                {s.chars != null && s.ok ? ` · ${s.chars} chars` : ""}
                {!s.ok && s.error ? ` — ${s.error}` : ""}
              </li>
            ))}
          </ul>
        ) : null}

        {error ? (
          <p className="mt-6 text-[0.9375rem] text-red-800/90">{error}</p>
        ) : null}

        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="mt-8 w-full border border-[var(--ink)] bg-[var(--paper)] py-3 font-doc-mono text-sm uppercase tracking-wider text-[var(--ink)] transition hover:bg-[var(--paper-2)] disabled:opacity-40"
        >
          {busy ? "Working…" : "Build draft & continue"}
        </button>
      </main>
    </div>
  );
}
