/** Default when `GEMINI_MODEL` is unset. Prefer a current model; older IDs may be unavailable to new API keys. */
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

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

type GeminiErrorBody = {
  error?: { message?: string; code?: number; status?: string };
};

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
};

/** Plain text completion via Google Gemini (no JSON mode). */
export async function chatCompletionPlainText(params: {
  system: string;
  user: string;
  temperature?: number;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[gemini] GEMINI_API_KEY is not set; add it to .env and restart the dev server.",
      );
    }
    throw new Error(
      "The writing step isn’t available on this server right now. Try again later.",
    );
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: params.system }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: params.user }],
        },
      ],
      generationConfig: {
        temperature: params.temperature ?? 0.6,
      },
    }),
  });

  const rawText = await res.text();
  let raw: GeminiResponse & GeminiErrorBody;
  try {
    raw = rawText ? (JSON.parse(rawText) as GeminiResponse & GeminiErrorBody) : {};
  } catch {
    throw new Error(
      "The writing service returned an unexpected response. Try again in a moment.",
    );
  }

  if (!res.ok) {
    const msg = raw.error?.message ?? "";
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

  const block = raw.promptFeedback?.blockReason;
  if (block) {
    throw new Error(
      "The writing step was blocked for this prompt. Try different source text or try again later.",
    );
  }

  const parts = raw.candidates?.[0]?.content?.parts;
  const content =
    parts?.map((p) => p.text ?? "").join("")?.trim() ?? "";
  if (!content) {
    throw new Error("No text came back from the writing step. Try again.");
  }

  return stripFence(content);
}

function parseJsonFromGeminiResponse(raw: GeminiResponse & GeminiErrorBody): unknown {
  const parts = raw.candidates?.[0]?.content?.parts;
  const text = parts?.map((p) => p.text ?? "").join("")?.trim() ?? "";
  if (!text) throw new Error("No JSON came back from the model. Try again.");
  const cleaned = stripFence(text);
  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    throw new Error("The model returned invalid JSON. Try again.");
  }
}

export type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

type StructuredParams = {
  system: string;
  userParts: GeminiPart[];
  responseSchema: Record<string, unknown>;
  temperature?: number;
};

/** Multimodal generateContent with JSON schema output (e.g. evidence extraction from PDFs). */
export async function generateStructuredFromParts<T>(params: StructuredParams): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "The writing step isn’t available on this server right now. Try again later.",
    );
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: params.system }],
      },
      contents: [
        {
          role: "user",
          parts: params.userParts,
        },
      ],
      generationConfig: {
        temperature: params.temperature ?? 0.25,
        responseMimeType: "application/json",
        responseSchema: params.responseSchema,
      },
    }),
  });

  const rawText = await res.text();
  let raw: GeminiResponse & GeminiErrorBody;
  try {
    raw = rawText ? (JSON.parse(rawText) as GeminiResponse & GeminiErrorBody) : {};
  } catch {
    throw new Error(
      "The writing service returned an unexpected response. Try again in a moment.",
    );
  }

  if (!res.ok) {
    const msg = raw.error?.message ?? "";
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

  const block = raw.promptFeedback?.blockReason;
  if (block) {
    throw new Error(
      "The writing step was blocked for this prompt. Try different sources or try again later.",
    );
  }

  return parseJsonFromGeminiResponse(raw) as T;
}

/** Text-only structured JSON (e.g. synthesize spec from evidence). */
export async function chatCompletionJson<T>(params: {
  system: string;
  user: string;
  responseSchema: Record<string, unknown>;
  temperature?: number;
}): Promise<T> {
  return generateStructuredFromParts<T>({
    system: params.system,
    userParts: [{ text: params.user }],
    responseSchema: params.responseSchema,
    temperature: params.temperature,
  });
}
