import { NextResponse } from "next/server";
import { chatProfileFromPdfsAndText } from "@/lib/gemini";
import { PHASE1_DRAFT_FROM_SOURCES_SYSTEM } from "@/lib/voice-pipeline-prompts";

export const maxDuration = 120;

const MAX_PER_SAMPLE = 24_000;
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_PDFS = 10;

function parseSamplesField(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) =>
        s.length > MAX_PER_SAMPLE
          ? `${s.slice(0, MAX_PER_SAMPLE)}\n\n[truncated]`
          : s,
      );
  } catch {
    return [];
  }
}

function parseTweetArchivesField(
  raw: FormDataEntryValue | null,
): { name: string; text: string }[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: { name: string; text: string }[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const name = (row as { name?: unknown }).name;
      const text = (row as { text?: unknown }).text;
      if (typeof text !== "string") continue;
      const t = text.trim();
      if (!t) continue;
      const clipped =
        t.length > MAX_PER_SAMPLE
          ? `${t.slice(0, MAX_PER_SAMPLE)}\n\n[truncated]`
          : t;
      out.push({
        name: typeof name === "string" && name.trim() ? name.trim() : "tweets.txt",
        text: clipped,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function isPdfFile(f: File): boolean {
  const n = f.name.toLowerCase();
  return f.type === "application/pdf" || n.endsWith(".pdf");
}

export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Send PDFs as multipart form data (field name: pdf)." },
        { status: 400 },
      );
    }

    const form = await req.formData();
    const rawFiles = form.getAll("pdf");
    const files = rawFiles.filter((x): x is File => x instanceof File && x.size > 0);

    const pdfFiles = files.filter((f) => {
      if (!isPdfFile(f)) return false;
      if (f.size > MAX_PDF_BYTES) return false;
      return true;
    });

    if (pdfFiles.length > MAX_PDFS) {
      return NextResponse.json(
        { error: `At most ${MAX_PDFS} PDFs per request.` },
        { status: 400 },
      );
    }

    const samples = parseSamplesField(form.get("samples"));
    const tweetArchives = parseTweetArchivesField(form.get("tweetArchives"));

    if (pdfFiles.length === 0) {
      return NextResponse.json(
        {
          error:
            "Upload at least one PDF (max 20 MB each). Optional pasted text can supplement the PDFs.",
        },
        { status: 400 },
      );
    }

    const pdfs: { name: string; dataBase64: string; bytes: number }[] = [];
    for (const file of pdfFiles) {
      const buf = Buffer.from(await file.arrayBuffer());
      pdfs.push({
        name: file.name || "document.pdf",
        dataBase64: buf.toString("base64"),
        bytes: buf.length,
      });
    }

    const tweetBlock =
      tweetArchives.length > 0
        ? tweetArchives
            .map((a) => `## Tweet archive: ${a.name}\n\n${a.text}`)
            .join("\n\n---\n\n")
        : "";

    const pastedBlock =
      samples.length > 0
        ? samples
            .map((s, i) => `## Pasted excerpt ${i + 1}\n\n${s}`)
            .join("\n\n---\n\n")
        : "";

    const intro = `You are given one or more PDFs of the author's writing, plus optional tweet-export text and pasted excerpts below. Read them for voice, cadence, and style — not to quote verbatim. Tweet archives skew short-form; PDFs often skew long-form — use both for a spec that covers different lengths.

Source material:
${tweetBlock ? `${tweetBlock}\n\n---\n\n` : ""}${pastedBlock ? `${pastedBlock}\n\n---\n\n` : ""}`;

    const userParts: Array<
      | { text: string }
      | { inline_data: { mime_type: string; data: string } }
    > = [{ text: intro }];

    for (let i = 0; i < pdfs.length; i++) {
      const p = pdfs[i];
      userParts.push({
        text: `--- PDF ${i + 1}: ${p.name} ---`,
      });
      userParts.push({
        inline_data: {
          mime_type: "application/pdf",
          data: p.dataBase64,
        },
      });
    }

    userParts.push({
      text: `Reply with ONLY the Markdown voice spec for phase 1 (see system instruction). No JSON. No preamble — start with the first heading or paragraph.`,
    });

    const document = await chatProfileFromPdfsAndText({
      system: PHASE1_DRAFT_FROM_SOURCES_SYSTEM,
      userParts,
      temperature: 0.35,
    });

    if (!document.trim()) {
      return NextResponse.json(
        {
          error:
            "The model returned an empty draft. Try different PDFs or fewer pages, then try again.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      document: document.trim(),
      sources: [
        ...tweetArchives.map((t) => ({
          name: t.name,
          ok: true,
          bytes: Buffer.byteLength(t.text, "utf8"),
        })),
        ...pdfs.map((p) => ({
          name: p.name,
          ok: true,
          bytes: p.bytes,
        })),
      ],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
