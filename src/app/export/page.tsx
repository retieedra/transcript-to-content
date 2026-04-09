"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ManifestoHeader } from "@/components/ManifestoHeader";
import { StepDots } from "@/components/StepDots";
import { clearAllProgress, loadFinalDocument } from "@/lib/profile-storage";

export default function ExportPage() {
  const router = useRouter();
  const [doc, setDoc] = useState<string | null>(null);

  useEffect(() => {
    const final = loadFinalDocument();
    if (!final) {
      router.replace("/");
      return;
    }
    setDoc(final);
  }, [router]);

  const download = () => {
    if (!doc) return;
    const blob = new Blob([doc], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "soul.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = () => {
    if (!doc) return;
    void navigator.clipboard.writeText(doc);
  };

  if (!doc) {
    return (
      <div className="flex min-h-full items-center justify-center font-doc-mono text-sm text-[var(--ink-muted)]">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <main className="mx-auto max-w-2xl px-5 py-14 sm:px-8 sm:py-16">
        <StepDots active={2} />
        <ManifestoHeader
          eyebrow="Your voice, one file"
          title="Here is soul.md"
          subtitle="Get your soul.md everywhere: keep it on disk, in git, or wherever you store notes. Paste it into custom instructions, Cursor rules, or any assistant—same voice for posts, essays, and whatever else you write, one file."
        />

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={download}
            className="border border-[var(--ink)] bg-[var(--paper)] px-5 py-2.5 font-doc-mono text-sm uppercase tracking-wider text-[var(--ink)] hover:bg-[var(--paper-2)]"
          >
            Download
          </button>
          <button
            type="button"
            onClick={copy}
            className="border border-[var(--rule)] bg-[var(--paper)] px-5 py-2.5 font-doc-mono text-sm uppercase tracking-wider text-[var(--ink)] hover:border-[var(--rule-strong)]"
          >
            Copy all
          </button>
          <button
            type="button"
            onClick={() => {
              clearAllProgress();
              router.push("/");
            }}
            className="border border-transparent px-5 py-2.5 font-doc-mono text-sm uppercase tracking-wider text-[var(--ink-muted)] underline decoration-[var(--rule-strong)] underline-offset-4 hover:text-[var(--ink)]"
          >
            Start over
          </button>
        </div>

        <pre className="type-input mt-10 max-h-[min(60vh,520px)] overflow-auto whitespace-pre-wrap border border-[var(--rule)] bg-[var(--paper-2)] p-5 text-[0.8125rem] leading-relaxed text-[var(--ink)]">
          {doc}
        </pre>
      </main>
    </div>
  );
}
