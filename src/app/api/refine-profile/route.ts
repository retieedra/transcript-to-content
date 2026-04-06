import { NextResponse } from "next/server";
import { chatCompletionPlainText } from "@/lib/openai";

type Item = { text: string; approved: boolean };

function parseItems(body: unknown): Item[] | null {
  if (!body || typeof body !== "object") return null;
  const items = (body as { items?: unknown }).items;
  if (!Array.isArray(items)) return null;
  const out: Item[] = [];
  for (const row of items) {
    if (!row || typeof row !== "object") continue;
    const text = (row as { text?: unknown }).text;
    const approved = (row as { approved?: unknown }).approved;
    if (typeof text !== "string" || typeof approved !== "boolean") continue;
    const t = text.trim();
    if (t) out.push({ text: t, approved });
  }
  return out.length ? out : null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const profile =
      typeof body.profile === "string" ? body.profile.trim() : "";
    const items = parseItems(body);

    if (!profile) {
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

    const liked = items.filter((i) => i.approved).map((i) => i.text);
    const disliked = items.filter((i) => !i.approved).map((i) => i.text);

    const document = await chatCompletionPlainText({
      system: `You revise a Markdown specification using the user's feedback on sample lines.
Same purpose: instructions for another model drafting in this style.
Strengthen patterns from approved lines; down-weight patterns from rejected lines.
Keep ## / ### structure. No meta commentary.`,
      user: `Current specification:\n${profile}\n\n---\nApproved sample lines:\n${liked.map((t, i) => `${i + 1}. ${t}`).join("\n") || "(none)"}\n\n---\nRejected sample lines:\n${disliked.map((t, i) => `${i + 1}. ${t}`).join("\n") || "(none)"}\n\n---\nReply with ONLY the full revised Markdown. No JSON. No preamble.`,
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
