import { NextResponse } from "next/server";
import { chatCompletionJson, chatCompletionPlainText } from "@/lib/gemini";
import { VOICE_SPEC_RESPONSE_SCHEMA } from "@/lib/gemini-json-schemas";
import { renderVoiceSpecMarkdown } from "@/lib/render-voice-spec-markdown";
import type { VoiceSpecJson } from "@/lib/voice-types";
import {
  LEGACY_REFINE_MARKDOWN_SYSTEM,
  REFINE_FROM_RATINGS_SYSTEM,
} from "@/lib/voice-pipeline-prompts";

type RatedItem = {
  text: string;
  approved: boolean;
  bucket?: string;
  tests?: string[];
  length?: string;
};

function parseItems(body: unknown): RatedItem[] | null {
  if (!body || typeof body !== "object") return null;
  const items = (body as { items?: unknown }).items;
  if (!Array.isArray(items)) return null;
  const out: RatedItem[] = [];
  for (const row of items) {
    if (!row || typeof row !== "object") continue;
    const text = (row as { text?: unknown }).text;
    const approved = (row as { approved?: unknown }).approved;
    if (typeof text !== "string" || typeof approved !== "boolean") continue;
    const t = text.trim();
    if (!t) continue;
    const bucket = (row as { bucket?: unknown }).bucket;
    const tests = (row as { tests?: unknown }).tests;
    const length = (row as { length?: unknown }).length;
    out.push({
      text: t,
      approved,
      bucket: typeof bucket === "string" ? bucket : undefined,
      tests: Array.isArray(tests) ? tests.filter((x): x is string => typeof x === "string") : undefined,
      length: typeof length === "string" ? length : undefined,
    });
  }
  return out.length ? out : null;
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
    const profile =
      typeof body.profile === "string" ? body.profile.trim() : "";
    const specJson = parseSpecJson(body);
    const items = parseItems(body);

    if (!profile && !specJson) {
      return NextResponse.json(
        {
          error:
            "The draft specification is missing. Go back to the first step and build the draft again.",
        },
        { status: 400 },
      );
    }
    if (!items) {
      return NextResponse.json(
        {
          error:
            "We couldn’t read your yes/no choices. Refresh the page, complete the line review again, then try finishing.",
        },
        { status: 400 },
      );
    }

    const liked = items.filter((i) => i.approved);
    const disliked = items.filter((i) => !i.approved);

    if (specJson) {
      const noApprovalsNote =
        liked.length === 0
          ? "\n(No thumbs-up lines — lean away from rejected patterns and keep the draft structure unless a rejection clearly contradicts it.)\n"
          : "";

      const approvedPayload = liked.map((x, i) => ({
        index: i + 1,
        text: x.text,
        bucket: x.bucket ?? null,
        tests: x.tests ?? [],
        length: x.length ?? null,
      }));

      const rejectedPayload = disliked.map((x, i) => ({
        index: i + 1,
        text: x.text,
        bucket: x.bucket ?? null,
        tests: x.tests ?? [],
        length: x.length ?? null,
      }));

      const user = `<context>\n<original_voice_spec_json>\n${JSON.stringify(specJson)}\n</original_voice_spec_json>\n\n<approved_items>${noApprovalsNote}\n${JSON.stringify(approvedPayload, null, 2)}\n</approved_items>\n\n<rejected_items>\n${JSON.stringify(rejectedPayload, null, 2)}\n</rejected_items>\n</context>\n\n<task>\nRevise the voice spec to better fit the human ratings.\n</task>\n\n<final_constraints>\nApproved items are the strongest positive signal.\nRejected items should mainly sharpen guardrails and anti-patterns.\nDo not invent traits unsupported by the original spec plus ratings.\nReturn JSON only.\n</final_constraints>`;

      const revised = await chatCompletionJson<VoiceSpecJson>({
        system: REFINE_FROM_RATINGS_SYSTEM,
        user,
        responseSchema: VOICE_SPEC_RESPONSE_SCHEMA,
        temperature: liked.length > 0 ? 0.35 : 0.3,
      });

      const document = renderVoiceSpecMarkdown(revised);

      if (!document.trim()) {
        return NextResponse.json(
          {
            error:
              "The model returned an empty file. Try finishing again, or restart from step 1.",
          },
          { status: 502 },
        );
      }

      return NextResponse.json({
        document: document.trim(),
        specJson: revised,
      });
    }

    const document = await chatCompletionPlainText({
      system: LEGACY_REFINE_MARKDOWN_SYSTEM,
      user: `Current specification:\n${profile}\n\n---\nApproved sample lines:\n${liked.map((t, i) => `${i + 1}. ${t.text}`).join("\n") || "(none)"}\n\n---\nRejected sample lines:\n${disliked.map((t, i) => `${i + 1}. ${t.text}`).join("\n") || "(none)"}\n\n---\nReply with ONLY the full revised Markdown. No JSON. No preamble.`,
      temperature: 0.4,
    });

    if (!document.trim()) {
      return NextResponse.json(
        {
          error:
            "The model returned an empty file. Try finishing again, or restart from step 1.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ document: document.trim() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
