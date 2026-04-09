import { NextResponse } from "next/server";
import { chatCompletionPlainText } from "@/lib/gemini";
import { phase2CalibrationSamplesSystem } from "@/lib/voice-pipeline-prompts";

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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const profile =
      typeof body.profile === "string" ? body.profile.trim() : "";
    const countRaw = (body as { count?: unknown }).count;
    const count =
      typeof countRaw === "number" && countRaw >= 4 && countRaw <= 14
        ? Math.floor(countRaw)
        : 10;

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
      system: phase2CalibrationSamplesSystem(count),
      user: `Draft voice specification (your samples must follow this; do not contradict it):\n\n${profile}`,
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
