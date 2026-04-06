"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ManifestoHeader } from "@/components/ManifestoHeader";
import { StepDots } from "@/components/StepDots";
import {
  loadCalibration,
  loadProfileDraft,
  saveCalibration,
  saveFinalDocument,
} from "@/lib/profile-storage";

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
        const res = await fetch("/api/generate-examples", {
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
      const res = await fetch("/api/refine-profile", {
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
      const res = await fetch("/api/generate-examples", {
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
          title="Does this sound like you?"
          subtitle="Read each line on its own. Mark the ones that could have been yours, and the ones that miss the mark. That feedback rewrites the spec before you download it."
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
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRating(i, true)}
                    className={`flex-1 border py-2 font-doc-mono text-[11px] uppercase tracking-wider transition ${
                      ratings[i] === true
                        ? "border-[var(--ink)] bg-[var(--paper-2)] text-[var(--ink)]"
                        : "border-[var(--rule)] text-[var(--ink-muted)] hover:border-[var(--rule-strong)]"
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setRating(i, false)}
                    className={`flex-1 border py-2 font-doc-mono text-[11px] uppercase tracking-wider transition ${
                      ratings[i] === false
                        ? "border-[var(--ink)] bg-[var(--paper-2)] text-[var(--ink)]"
                        : "border-[var(--rule)] text-[var(--ink-muted)] hover:border-[var(--rule-strong)]"
                    }`}
                  >
                    No
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
              {submitBusy ? "Updating…" : "Finish & download"}
            </button>
            {!allRated ? (
              <p className="mt-2 text-center font-doc-mono text-[11px] text-[var(--ink-muted)]">
                Answer every line to continue.
              </p>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}
