"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ManifestoHeader } from "@/components/ManifestoHeader";
import { StepDots } from "@/components/StepDots";
import { withBasePath } from "@/lib/appPath";
import {
  loadCalibration,
  loadProfileDraft,
  saveCalibration,
  saveFinalDocument,
} from "@/lib/profile-storage";

function ThumbUpIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-7.41a2 2 0 0 1 .59-1.59L11.29 2.59a2 2 0 0 1 3.02-.25l.92 1.09A2 2 0 0 1 16 6.04V10" />
    </svg>
  );
}

function ThumbDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17 14V2" />
      <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v7.41a2 2 0 0 1-.59 1.59L12.71 21.41a2 2 0 0 1-3.02.25l-.92-1.09A2 2 0 0 1 8 17.96V14" />
    </svg>
  );
}

export default function CalibratePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<string | null>(null);
  const [examples, setExamples] = useState<string[]>([]);
  const [ratings, setRatings] = useState<Array<boolean | null>>([]);
  const [loadBusy, setLoadBusy] = useState(true);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [finishError, setFinishError] = useState<string | null>(null);

  useEffect(() => {
    const draft = loadProfileDraft();
    if (!draft) {
      router.replace("/");
      return;
    }
    setProfile(draft);

    const cached = loadCalibration();
    if (
      cached &&
      cached.examples.length > 0 &&
      cached.ratings.length === cached.examples.length
    ) {
      setExamples(cached.examples);
      setRatings(cached.ratings);
      setLoadBusy(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadBusy(true);
      setLoadError(null);
      try {
        const res = await fetch(withBasePath("/api/generate-examples"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile: draft, count: 10 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? res.statusText);
        const lines = Array.isArray(data.lines) ? data.lines : [];
        if (!lines.length) throw new Error("No lines returned.");
        if (cancelled) return;
        const nextRatings = lines.map(() => null as boolean | null);
        setExamples(lines);
        setRatings(nextRatings);
        saveCalibration({ examples: lines, ratings: nextRatings });
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Failed to load lines");
        }
      } finally {
        if (!cancelled) setLoadBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const setRating = useCallback(
    (index: number, value: boolean) => {
      setRatings((r) => {
        const next = [...r];
        next[index] = value;
        if (examples.length) {
          saveCalibration({ examples, ratings: next });
        }
        return next;
      });
    },
    [examples],
  );

  const allRated = ratings.length > 0 && ratings.every((x) => x !== null);

  const finish = async () => {
    if (!profile || !allRated) return;
    setSubmitBusy(true);
    setFinishError(null);
    try {
      const items = examples.map((text, i) => ({
        text,
        approved: ratings[i] === true,
      }));
      const res = await fetch(withBasePath("/api/refine-profile"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      const doc = typeof data.document === "string" ? data.document : "";
      if (!doc) throw new Error("Empty document.");
      saveFinalDocument(doc);
      router.push("/export");
    } catch (e) {
      setFinishError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setSubmitBusy(false);
    }
  };

  const retryFetch = async () => {
    const p = profile ?? loadProfileDraft();
    if (!p) return;
    setLoadBusy(true);
    setLoadError(null);
    try {
      const res = await fetch(withBasePath("/api/generate-examples"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: p, count: 10 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      const lines = Array.isArray(data.lines) ? data.lines : [];
      if (!lines.length) throw new Error("No lines returned.");
      const nextRatings = lines.map(() => null as boolean | null);
      setExamples(lines);
      setRatings(nextRatings);
      saveCalibration({ examples: lines, ratings: nextRatings });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load lines");
    } finally {
      setLoadBusy(false);
    }
  };

  return (
    <div className="min-h-full">
      <main className="mx-auto max-w-2xl px-5 py-14 sm:px-8 sm:py-16">
        <StepDots active={1} />
        <ManifestoHeader
          title="Finetune"
          subtitle="Read each line on its own. Thumb up if it could be yours, thumb down if it misses. That feedback rewrites the spec before you download."
        />

        <p className="mt-8 text-center font-doc-mono text-[11px] text-[var(--ink-muted)]">
          <Link
            href="/"
            className="border-b border-[var(--rule-strong)] hover:border-[var(--ink)]"
          >
            ← Change links or pasted text
          </Link>
        </p>

        {loadBusy ? (
          <p className="mt-12 text-center font-doc-mono text-sm text-[var(--ink-muted)]">
            Drafting lines…
          </p>
        ) : null}

        {loadError && !loadBusy ? (
          <div className="mt-10 border border-[var(--rule-strong)] bg-[var(--paper-2)] p-4 text-center text-sm text-[var(--ink)]">
            {loadError}
            <button
              type="button"
              onClick={() => void retryFetch()}
              className="mt-3 w-full border border-[var(--rule)] py-2 font-doc-mono text-[11px] uppercase tracking-wider hover:border-[var(--ink)]"
            >
              Try again
            </button>
          </div>
        ) : null}

        {!loadBusy && examples.length > 0 ? (
          <ul className="mt-12 space-y-4">
            {examples.map((line, i) => (
              <li
                key={i}
                className="border border-[var(--rule)] bg-[var(--paper)] p-4"
              >
                <p className="text-[0.9375rem] leading-relaxed text-[var(--ink)]">
                  {line}
                </p>
                <div className="mt-4 flex justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => setRating(i, true)}
                    aria-label="Thumb up — fits"
                    title="Fits"
                    className={`flex h-12 w-12 items-center justify-center rounded-full border-2 transition ${
                      ratings[i] === true
                        ? "border-emerald-600/50 bg-emerald-100/90 text-emerald-900"
                        : "border-[var(--rule)] bg-[var(--paper)] text-emerald-800/40 hover:border-emerald-400/50 hover:bg-emerald-50/80 hover:text-emerald-800"
                    }`}
                  >
                    <ThumbUpIcon className="h-6 w-6" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRating(i, false)}
                    aria-label="Thumb down — doesn’t fit"
                    title="Doesn’t fit"
                    className={`flex h-12 w-12 items-center justify-center rounded-full border-2 transition ${
                      ratings[i] === false
                        ? "border-rose-600/50 bg-rose-100/90 text-rose-900"
                        : "border-[var(--rule)] bg-[var(--paper)] text-rose-800/40 hover:border-rose-400/50 hover:bg-rose-50/80 hover:text-rose-800"
                    }`}
                  >
                    <ThumbDownIcon className="h-6 w-6" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {!loadBusy && examples.length > 0 ? (
          <div className="mt-12">
            {finishError && allRated ? (
              <p className="mb-3 text-center text-sm text-red-800/90">
                {finishError}
              </p>
            ) : null}
            <button
              type="button"
              disabled={!allRated || submitBusy}
              onClick={() => void finish()}
              className="w-full border border-[var(--ink)] bg-[var(--paper)] py-3 font-doc-mono text-sm uppercase tracking-wider text-[var(--ink)] hover:bg-[var(--paper-2)] disabled:opacity-40"
            >
              {submitBusy ? "Finishing…" : "Finish"}
            </button>
            {!allRated ? (
              <p className="mt-2 text-center font-doc-mono text-[11px] text-[var(--ink-muted)]">
                Thumb up or down on every line to continue.
              </p>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}
