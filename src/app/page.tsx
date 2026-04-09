"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ManifestoHeader } from "@/components/ManifestoHeader";
import { SpinningManifold } from "@/components/SpinningManifold";
import { StepDots } from "@/components/StepDots";
import { saveProfileDraft } from "@/lib/profile-storage";
import { withBasePath } from "@/lib/appPath";

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_PDFS = 10;
const TWEET_ARCHIVE_MAX = 4 * 1024 * 1024;
const MAX_TWEET_FILES = 10;

type TweetArchive = { name: string; text: string };

type SourceRow = {
  name: string;
  ok: boolean;
  bytes?: number;
  error?: string;
};

export default function Home() {
  const router = useRouter();
  const [chunks, setChunks] = useState<string[]>([""]);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [tweetArchives, setTweetArchives] = useState<TweetArchive[]>([]);
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

  const removePdf = useCallback((i: number) => {
    setPdfFiles((f) => f.filter((_, j) => j !== i));
  }, []);

  const removeTweetArchive = useCallback((i: number) => {
    setTweetArchives((a) => a.filter((_, j) => j !== i));
  }, []);

  const onTweetArchives = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const { files } = e.target;
      if (!files?.length) return;
      const next: TweetArchive[] = [];
      for (const f of files) {
        if (f.size > TWEET_ARCHIVE_MAX) continue;
        const t = await f.text();
        if (t.trim()) next.push({ name: f.name, text: t.trim() });
      }
      if (next.length) {
        setTweetArchives((prev) => {
          const merged = [...prev, ...next];
          return merged.slice(0, MAX_TWEET_FILES);
        });
      }
      e.target.value = "";
    },
    [],
  );

  const onPdfInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = e.target;
    if (!files?.length) return;
    const next: File[] = [];
    for (const f of files) {
      if (f.size > MAX_PDF_BYTES) continue;
      const lower = f.name.toLowerCase();
      if (f.type !== "application/pdf" && !lower.endsWith(".pdf")) continue;
      next.push(f);
    }
    if (next.length) {
      setPdfFiles((prev) => {
        const merged = [...prev, ...next];
        return merged.slice(0, MAX_PDFS);
      });
    }
    e.target.value = "";
  }, []);

  const submit = async () => {
    setError(null);
    setSources(null);
    const pasteBlocks = chunks.map((s) => s.trim()).filter(Boolean);

    if (pdfFiles.length === 0) {
      setError("Upload at least one PDF.");
      return;
    }

    const form = new FormData();
    form.append("samples", JSON.stringify(pasteBlocks));
    form.append("tweetArchives", JSON.stringify(tweetArchives));
    for (const f of pdfFiles) {
      form.append("pdf", f);
    }

    setBusy(true);
    try {
      const res = await fetch(withBasePath("/api/profile-from-samples"), {
        method: "POST",
        body: form,
      });
      let data: Record<string, unknown> = {};
      const raw = await res.text();
      try {
        data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      } catch {
        setError(
          "Something went wrong with the response. Try again in a moment.",
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
          eyebrow="Get your soul.md everywhere"
          title="Your voice, one file"
          subtitle="Upload PDFs of your writing—short or long, mixed is good. We turn that into a spec with options for different kinds of content, you finetune with a few ratings, then you download soul.md to reuse anywhere."
        />

        <aside className="mt-10 border border-[var(--rule)] bg-[var(--paper-2)] p-4 text-left text-[0.8125rem] leading-relaxed text-[var(--ink-muted)]">
          <p className="font-doc-mono text-[10px] uppercase tracking-widest text-[var(--ink)]">
            What you walk away with
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>
              A voice spec with options for short- and long-form (and more), in
              one file.
            </li>
            <li>
              A finetune pass: mixed sample lines, thumbs up or down.
            </li>
            <li>
              soul.md: one file, your voice, paste it into chats and IDEs
              wherever you write.
            </li>
          </ul>
        </aside>

        <section className="mt-10 space-y-4 border border-[var(--rule)] bg-[var(--paper)] p-5 sm:p-6">
          <h2 className="font-doc-mono text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--ink)]">
            What to include
          </h2>
          <p className="text-[0.875rem] leading-relaxed text-[var(--ink-muted)]">
            The exported spec is meant for{" "}
            <strong className="font-medium text-[var(--ink)]">all kinds of</strong>{" "}
            content: short posts and long pieces, not only one mode. Mix sources
            so the model sees how you sound in different lengths.
          </p>
          <ul className="space-y-2 text-[0.875rem] leading-relaxed text-[var(--ink-muted)]">
            <li>
              <span className="text-[var(--ink)]">Helpful:</span> original
              writing in more than one register (e.g. tight blurbs and slower
              essays), recent polished work, your own words rather than mostly
              quotes or reposts.
            </li>
            <li>
              <span className="text-[var(--ink)]">Thin on their own:</span> only
              generic one-liners, or PDFs that are mostly other people’s text
              with little of you.
            </li>
          </ul>
          <p className="border-t border-[var(--rule)] pt-4 text-[0.875rem] leading-relaxed text-[var(--ink-muted)]">
            Export or save work as PDF when you can: articles, reports, talks,
            newsletters, essays, threads turned into PDFs, interviews. Scanned
            PDFs may work if the text is clear; native text PDFs work best.
          </p>
        </section>

        <section className="mt-6 space-y-3 border-2 border-dashed border-[var(--rule-strong)] bg-[var(--paper-2)] p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <h2 className="font-doc-mono text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--ink)]">
                PDFs
              </h2>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-[var(--ink-muted)]">
                Upload one or more PDFs (up to {MAX_PDFS} files,{" "}
                {MAX_PDF_BYTES / 1024 / 1024} MB each). This is the only required
                input.
              </p>
            </div>
            <label className="shrink-0 cursor-pointer border border-[var(--ink)] bg-[var(--paper)] px-3 py-2.5 text-center font-doc-mono text-[11px] uppercase tracking-wider text-[var(--ink)] hover:bg-[var(--paper-2)]">
              Choose PDFs
              <input
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="sr-only"
                onChange={(e) => void onPdfInput(e)}
              />
            </label>
          </div>
          {pdfFiles.length > 0 ? (
            <ul className="space-y-1 font-doc-mono text-[11px] text-[var(--ink-muted)]">
              {pdfFiles.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between gap-2 border border-[var(--rule)] bg-[var(--paper)] px-2 py-1.5"
                >
                  <span className="truncate text-[var(--ink)]">{f.name}</span>
                  <span className="shrink-0 text-[var(--ink-muted)]">
                    {(f.size / 1024).toFixed(1)} KB
                  </span>
                  <button
                    type="button"
                    onClick={() => removePdf(i)}
                    className="shrink-0 uppercase tracking-wider hover:text-[var(--ink)]"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="mt-6 space-y-3 border-2 border-dashed border-[var(--rule-strong)] bg-[var(--paper-2)] p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <h2 className="font-doc-mono text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--ink)]">
                Tweet export
              </h2>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-[var(--ink-muted)]">
                Separate upload for X posts: bring an export or converted file (
                <span className="font-doc-mono text-[0.8125rem]">.txt</span>,{" "}
                <span className="font-doc-mono text-[0.8125rem]">.csv</span>,{" "}
                <span className="font-doc-mono text-[0.8125rem]">.json</span>,
                etc.). Official path:{" "}
                <strong className="font-medium text-[var(--ink)]">
                  Settings and privacy
                </strong>{" "}
                →{" "}
                <strong className="font-medium text-[var(--ink)]">
                  Your account
                </strong>{" "}
                →{" "}
                <strong className="font-medium text-[var(--ink)]">
                  Download an archive of your data
                </strong>
                , then pull post text from the ZIP if needed. Up to{" "}
                {TWEET_ARCHIVE_MAX / 1024 / 1024} MB per file,{" "}
                {MAX_TWEET_FILES} files. Optional but great for short-form
                signal alongside PDFs.
              </p>
            </div>
            <label className="shrink-0 cursor-pointer border border-[var(--ink)] bg-[var(--paper)] px-3 py-2.5 text-center font-doc-mono text-[11px] uppercase tracking-wider text-[var(--ink)] hover:bg-[var(--paper-2)]">
              Choose files
              <input
                type="file"
                accept=".txt,.text,.csv,.json,.js,.html,.md,.markdown"
                multiple
                className="sr-only"
                onChange={(e) => void onTweetArchives(e)}
              />
            </label>
          </div>
          {tweetArchives.length > 0 ? (
            <ul className="space-y-1 font-doc-mono text-[11px] text-[var(--ink-muted)]">
              {tweetArchives.map((a, i) => (
                <li
                  key={`${a.name}-${i}`}
                  className="flex items-center justify-between gap-2 border border-[var(--rule)] bg-[var(--paper)] px-2 py-1.5"
                >
                  <span className="truncate text-[var(--ink)]">{a.name}</span>
                  <span className="shrink-0 text-[var(--ink-muted)]">
                    {a.text.length.toLocaleString()} chars
                  </span>
                  <button
                    type="button"
                    onClick={() => removeTweetArchive(i)}
                    className="shrink-0 uppercase tracking-wider hover:text-[var(--ink)]"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="mt-6 space-y-3 border border-[var(--rule)] bg-[var(--paper)] p-5 sm:p-6">
          <h2 className="font-doc-mono text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--ink)]">
            Optional: paste extra excerpts
          </h2>
          <p className="text-[0.9375rem] leading-relaxed text-[var(--ink-muted)]">
            Plain text or Markdown snippets that are not in the PDFs, or a
            short passage you want weighted alongside the uploads.
          </p>

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
                  placeholder="Optional…"
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
            {sources.map((s, i) => (
              <li key={`${s.name}-${i}`}>
                {s.ok ? "ok" : "fail"} · {s.name}
                {s.bytes != null && s.ok
                  ? ` · ${s.bytes.toLocaleString()} bytes`
                  : ""}
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
