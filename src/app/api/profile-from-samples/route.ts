import { NextResponse } from "next/server";
import { clipText, scrapeMarkdown } from "@/lib/firecrawl";
import { chatCompletionPlainText } from "@/lib/openai";

const MAX_PER_SAMPLE = 24_000;
const MAX_PER_SCRAPE = 14_000;
const MAX_TOTAL = 100_000;

function parseUrls(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const urls = (body as { urls?: unknown }).urls;
  if (!Array.isArray(urls)) return [];
  return urls
    .filter((u): u is string => typeof u === "string")
    .map((u) => u.trim())
    .filter(Boolean);
}

function parseSamples(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const samples = (body as { samples?: unknown }).samples;
  if (!Array.isArray(samples)) return [];
  return samples
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) =>
      s.length > MAX_PER_SAMPLE ? `${s.slice(0, MAX_PER_SAMPLE)}\n\n[truncated]` : s,
    );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const urls = parseUrls(body);
    const samples = parseSamples(body);

    if (urls.length === 0 && samples.length === 0) {
      return NextResponse.json(
        {
          error:
            "Add at least one link or one pasted excerpt. Links must be public pages that open in your browser without logging in.",
        },
        { status: 400 },
      );
    }

    const scraped = await Promise.all(
      urls.map((url) =>
        scrapeMarkdown(url).then((r) => ({
          ...r,
          markdown: clipText(r.markdown, MAX_PER_SCRAPE),
        })),
      ),
    );

    const parts: string[] = [];

    for (const row of scraped) {
      if (row.markdown) {
        parts.push(`## From link: ${row.url}\n\n${row.markdown}`);
      } else {
        parts.push(
          `## From link: ${row.url}\n\n_[Fetch failed: ${row.error ?? "unknown"}]_`,
        );
      }
    }

    samples.forEach((s, i) => {
      parts.push(`## Pasted excerpt ${i + 1}\n\n${s}`);
    });

    let combined = parts.join("\n\n---\n\n");
    if (combined.length > MAX_TOTAL) {
      combined = `${combined.slice(0, MAX_TOTAL)}\n\n[truncated]`;
    }

    const hasRealText = scraped.some((s) => s.markdown.length > 0) || samples.length > 0;
    if (!hasRealText) {
      return NextResponse.json(
        {
          error:
            "We couldn’t read any text from your links, and Step 2 is empty. Fix failing links, paste writing in Step 2, or try different public URLs.",
          sources: scraped.map(({ url, markdown, error }) => ({
            url,
            ok: Boolean(markdown),
            error,
          })),
        },
        { status: 400 },
      );
    }

    const document = await chatCompletionPlainText({
      system: `You write a single Markdown document for another model to read before drafting text on the author's behalf.
Use ## and ### headings (cadence, diction, punctuation, formatting, register, recurring moves).
Stay concrete; no fluff; paraphrase—don’t paste long quotes. Ignore sections that are only fetch-error placeholders.
End with a short checklist.`,
      user: `Source material:\n\n${combined}\n\n---\nReply with ONLY that Markdown document. No JSON. No preamble—start with the first heading or paragraph.`,
      temperature: 0.35,
    });

    if (!document.trim()) {
      return NextResponse.json(
        {
          error:
            "The model returned an empty draft. Try again with fewer links or more pasted text in Step 2.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      document: document.trim(),
      sources: scraped.map(({ url, markdown, error }) => ({
        url,
        ok: Boolean(markdown),
        chars: markdown.length,
        error,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
