import { NextResponse } from "next/server";
import { chatCompletionJson, chatCompletionPlainText } from "@/lib/gemini";
import { CALIBRATION_RESPONSE_SCHEMA } from "@/lib/gemini-json-schemas";
import type { CalibrationJson, VoiceSpecJson } from "@/lib/voice-types";
import { CALIBRATION_GENERATION_SYSTEM } from "@/lib/voice-pipeline-prompts";

function splitIntoLines(text: string, want: number): string[] {
  const byRule = text
    .split(/\n---+\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  let parts = byRule.length >= 2 ? byRule : [];

  if (parts.length < 2) {
    parts = text
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
  }
  if (parts.length < 2) {
    parts = text
      .split(/\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !/^(line|sample)\s*\d+/i.test(l));
  }
  return parts.slice(0, want);
}

function parseSpecJson(body: unknown): VoiceSpecJson | null {
  if (!body || typeof body !== "object") return null;
  const s = (body as { specJson?: unknown }).specJson;
  if (!s || typeof s !== "object") return null;
  const o = s as Record<string, unknown>;
  if (typeof o.oneLineSummary !== "string") return null;
  return s as VoiceSpecJson;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const countRaw = (body as { count?: unknown }).count;
    const count =
      typeof countRaw === "number" && countRaw >= 4 && countRaw <= 14
        ? Math.floor(countRaw)
        : 10;

    const specJson = parseSpecJson(body);
    const profile =
      typeof (body as { profile?: unknown }).profile === "string"
        ? (body as { profile: string }).profile.trim()
        : "";

    if (specJson) {
      const coverageNote = `Include a mix of short, medium, and longer passages. Cover the major style dimensions in the spec. At least 30% of items should be near-misses or boundary tests (use the bucket field accordingly).`;

      const user = `<context>\n<voice_spec_json>\n${JSON.stringify(specJson)}\n</voice_spec_json>\n<count>${count}</count>\n</context>\n\n<task>\nGenerate a calibration set for thumbs up / thumbs down rating.\n</task>\n\n<coverage_requirements>\n${coverageNote}\n</coverage_requirements>\n\n<final_constraints>\nReturn JSON only.\nEach item must be a standalone passage.\nDo not mention buckets or tests inside the text itself.\n</final_constraints>`;

      const data = await chatCompletionJson<CalibrationJson>({
        system: CALIBRATION_GENERATION_SYSTEM,
        user,
        responseSchema: CALIBRATION_RESPONSE_SCHEMA,
        temperature: 0.9,
      });

      const items = Array.isArray(data.items) ? data.items : [];
      const trimmed = items.slice(0, count).filter((i) => i?.text?.trim());
      if (trimmed.length === 0) {
        return NextResponse.json(
          {
            error:
              "The model didn’t return usable calibration items. Try again, or rebuild the draft in step 1.",
          },
          { status: 502 },
        );
      }

      return NextResponse.json({ items: trimmed });
    }

    if (!profile) {
      return NextResponse.json(
        {
          error:
            "No specification to work from. Go back to step 1 and run “Build draft & continue” first.",
        },
        { status: 400 },
      );
    }

    const text = await chatCompletionPlainText({
      system: `You write standalone sample passages for a style test. Neutral topics are fine.
Mix formats so the user can rate both modes:
- About half the passages: short (one to three sentences, or social-length).
- About half: longer (one short paragraph, roughly 4–8 sentences, as for an essay chunk or email body).
Reply with exactly ${count} passages. Separate each passage with a line containing only three dashes: ---
No numbering, no section labels, no introduction—just passages and --- between them.`,
      user: `Specification (Markdown):\n${profile}`,
      temperature: 0.85,
    });

    const linesArr = splitIntoLines(text, count);

    if (linesArr.length === 0) {
      return NextResponse.json(
        {
          error:
            "The model didn’t return usable lines. Try again, or rebuild the draft in step 1.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ lines: linesArr });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
