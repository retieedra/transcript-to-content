import { NextResponse } from "next/server";
import {
  chatCompletionJson,
  generateStructuredFromParts,
  type GeminiPart,
} from "@/lib/gemini";
import {
  EVIDENCE_RESPONSE_SCHEMA,
  VOICE_SPEC_RESPONSE_SCHEMA,
} from "@/lib/gemini-json-schemas";
import { renderVoiceSpecMarkdown } from "@/lib/render-voice-spec-markdown";
import type { EvidenceJson, SourceManifestEntry, VoiceSpecJson } from "@/lib/voice-types";
import {
  EXTRACT_EVIDENCE_SYSTEM,
  SYNTHESIZE_VOICE_SPEC_SYSTEM,
} from "@/lib/voice-pipeline-prompts";

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

function buildManifestAndParts(params: {
  tweetArchives: { name: string; text: string }[];
  samples: string[];
  pdfs: { name: string; dataBase64: string; bytes: number }[];
}): { manifest: SourceManifestEntry[]; userParts: GeminiPart[] } {
  const manifest: SourceManifestEntry[] = [];
  const head: string[] = [];

  head.push(`<context>\n<source_manifest>\n`);

  for (let i = 0; i < params.tweetArchives.length; i++) {
    const sourceId = `tweet-${i}`;
    manifest.push({
      sourceId,
      type: "tweet_archive",
      label: params.tweetArchives[i].name,
    });
  }
  for (let j = 0; j < params.samples.length; j++) {
    const sourceId = `paste-${j}`;
    manifest.push({
      sourceId,
      type: "pasted_text",
      label: `paste-${j + 1}`,
    });
  }
  for (let k = 0; k < params.pdfs.length; k++) {
    const sourceId = `pdf-${k}`;
    manifest.push({
      sourceId,
      type: "pdf",
      label: params.pdfs[k].name,
    });
  }

  head.push(JSON.stringify(manifest, null, 2));
  head.push(`\n</source_manifest>\n\n<source_content>\n`);

  for (let t = 0; t < params.tweetArchives.length; t++) {
    const id = `tweet-${t}`;
    head.push(
      `[source id="${id}" type="tweet_archive"]\n${params.tweetArchives[t].text}\n[/source]\n\n`,
    );
  }
  for (let p = 0; p < params.samples.length; p++) {
    const id = `paste-${p}`;
    head.push(
      `[source id="${id}" type="pasted_text"]\n${params.samples[p]}\n[/source]\n\n`,
    );
  }

  const userParts: GeminiPart[] = [{ text: head.join("") }];

  for (let k = 0; k < params.pdfs.length; k++) {
    const id = `pdf-${k}`;
    userParts.push({
      text: `[source id="${id}" type="pdf"]\nFile: ${params.pdfs[k].name}\n`,
    });
    userParts.push({
      inline_data: {
        mime_type: "application/pdf",
        data: params.pdfs[k].dataBase64,
      },
    });
    userParts.push({ text: `[/source]\n\n` });
  }

  userParts.push({
    text: `</source_content>\n\n<task>\nBased on the entire source set above, extract only evidence-backed voice patterns.\n</task>\n\n<final_constraints>\nUse only the provided material. Perform logical deductions from the provided material when justified. Do not introduce outside knowledge. If a trait is unsupported, mark it as uncertain. Return JSON only.\n</final_constraints>`,
  });

  return { manifest, userParts };
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

    const { manifest, userParts } = buildManifestAndParts({
      tweetArchives,
      samples,
      pdfs,
    });

    const evidenceJson = await generateStructuredFromParts<EvidenceJson>({
      system: EXTRACT_EVIDENCE_SYSTEM,
      userParts,
      responseSchema: EVIDENCE_RESPONSE_SCHEMA,
      temperature: 0.2,
    });

    const synthesizeUser = `<context>\n<evidence_json>\n${JSON.stringify(evidenceJson)}\n</evidence_json>\n</context>\n\n<task>\nTurn this evidence into a reusable voice spec.\n</task>\n\n<final_constraints>\nBase every stable rule on repeated evidence.\nIf a trait is weakly supported, place it under optional variation or uncertainty.\nReturn JSON only.\n</final_constraints>`;

    const specJson = await chatCompletionJson<VoiceSpecJson>({
      system: SYNTHESIZE_VOICE_SPEC_SYSTEM,
      user: synthesizeUser,
      responseSchema: VOICE_SPEC_RESPONSE_SCHEMA,
      temperature: 0.35,
    });

    const document = renderVoiceSpecMarkdown(specJson);

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
      specJson,
      evidenceJson,
      manifest,
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
