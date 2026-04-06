function stripFence(s: string): string {
  let t = s.trim();
  if (t.startsWith("```")) {
    t = t
      .replace(/^```(?:markdown|md|json)?\s*/i, "")
      .replace(/\s*```$/u, "")
      .trim();
  }
  return t;
}

/** Plain completion — no JSON mode, fewer ways for the API/model to fail. */
export async function chatCompletionPlainText(params: {
  system: string;
  user: string;
  temperature?: number;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[openai] OPENAI_API_KEY is not set; add it to .env and restart the dev server.",
      );
    }
    throw new Error(
      "The writing step isn’t available on this server right now. Try again later.",
    );
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: params.temperature ?? 0.6,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
    }),
  });

  const rawText = await res.text();
  let raw: Record<string, unknown>;
  try {
    raw = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
  } catch {
    throw new Error(
      "The writing service returned an unexpected response. Try again in a moment.",
    );
  }

  if (!res.ok) {
    const msg =
      (raw.error as { message?: string } | undefined)?.message ?? "";
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "The writing step couldn’t authorize this request. If you run this app yourself, check the server configuration.",
      );
    }
    if (res.status === 429) {
      throw new Error(
        "Too many writing requests right now. Wait a bit and try again.",
      );
    }
    if (
      res.status === 402 ||
      msg.toLowerCase().includes("quota") ||
      msg.toLowerCase().includes("billing")
    ) {
      throw new Error(
        "Writing quota or billing blocked this request. Try again later.",
      );
    }
    throw new Error(
      msg
        ? `The writing step failed: ${msg}`
        : "The writing step failed. Try again in a moment.",
    );
  }

  const choice = (raw.choices as Array<{ message?: { content?: string } }> | undefined)?.[0];
  const content = choice?.message?.content?.trim() ?? "";
  if (!content) {
    throw new Error("No text came back from the writing step. Try again.");
  }

  return stripFence(content);
}
