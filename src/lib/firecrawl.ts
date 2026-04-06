const DEFAULT_BASE = "https://api.firecrawl.dev/v2";

export type ScrapeResult = {
  url: string;
  markdown: string;
  error?: string;
};

function getBaseUrl(): string {
  return (process.env.FIRECRAWL_API_URL ?? DEFAULT_BASE).replace(/\/$/, "");
}

/** Logs raw Firecrawl HTTP body per URL (server terminal). Set FIRECRAWL_LOG_MAX=0 for one-line only. */
function logFirecrawlResponse(
  url: string,
  httpStatus: number,
  rawText: string,
): void {
  if (process.env.FIRECRAWL_LOG === "0") return;

  const limitRaw = process.env.FIRECRAWL_LOG_MAX;
  if (limitRaw === "0") {
    console.log(
      `[firecrawl] ${url} → HTTP ${httpStatus}, body ${rawText.length} bytes`,
    );
    return;
  }

  const max = limitRaw
    ? Math.max(0, parseInt(limitRaw, 10) || 12_000)
    : 12_000;
  if (max === 0) {
    console.log(
      `[firecrawl] ${url} → HTTP ${httpStatus}, body ${rawText.length} bytes`,
    );
    return;
  }

  const preview =
    rawText.length > max
      ? `${rawText.slice(0, max)}\n… [truncated ${rawText.length - max} more bytes; set FIRECRAWL_LOG_MAX for more]`
      : rawText;
  console.log(`[firecrawl] ${url} HTTP ${httpStatus} response:\n${preview}`);
}

function formatFirecrawlError(
  json: Record<string, unknown> | null,
  status: number,
  statusText: string,
): string {
  if (!json) {
    return `Request failed (${status} ${statusText || "error"})`;
  }
  const err = json.error;
  if (typeof err === "string" && err.trim()) return err.trim();
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m.trim();
  }
  const code = json.code;
  if (typeof code === "string") {
    const e = typeof json.error === "string" ? json.error : "";
    return [code, e].filter(Boolean).join(": ");
  }
  try {
    return JSON.stringify(json);
  } catch {
    return statusText || "Unknown error";
  }
}

export async function scrapeMarkdown(url: string): Promise<ScrapeResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY?.trim();
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[firecrawl] FIRECRAWL_API_KEY is not set; link imports will fail until it is added to .env",
      );
    }
    return {
      url,
      markdown: "",
      error:
        "We couldn’t load this page. Try a different public link, or paste your writing in Step 2.",
    };
  }

  const endpoint = `${getBaseUrl()}/scrape`;
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url: url.trim(),
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 5000,
        proxy: "auto",
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    console.error(`[firecrawl] ${url} fetch error:`, msg);
    return {
      url,
      markdown: "",
      error: `We couldn’t reach the page service (${msg}). Try again, or paste your text in Step 2.`,
    };
  }

  const rawText = await res.text();
  logFirecrawlResponse(url, res.status, rawText);

  let json: Record<string, unknown> | null = null;
  if (rawText) {
    try {
      json = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      return {
        url,
        markdown: "",
        error:
          "Something went wrong loading this link. Try another URL or paste the text in Step 2.",
      };
    }
  }

  const success = json?.success === true;
  const data = json?.data as Record<string, unknown> | undefined;
  const markdown =
    (typeof data?.markdown === "string" && data.markdown) ||
    (typeof data?.content === "string" && data.content) ||
    "";

  if (!res.ok || !success) {
    const err = formatFirecrawlError(json, res.status, res.statusText);
    if (res.status === 401 || res.status === 403) {
      return {
        url,
        markdown: "",
        error:
          "This link couldn’t be accessed. Try another public page or paste your writing in Step 2.",
      };
    }
    if (res.status === 402) {
      return {
        url,
        markdown: "",
        error:
          "The page service declined this request (quota or billing). Try again later or paste your text in Step 2.",
      };
    }
    if (res.status === 429) {
      return {
        url,
        markdown: "",
        error:
          "Too many requests right now. Wait a bit, try fewer links, or paste your text in Step 2.",
      };
    }
    if (res.status >= 400 && res.status < 500) {
      return {
        url,
        markdown: "",
        error: `${err} — try another link or paste an excerpt in Step 2.`,
      };
    }
    return {
      url,
      markdown: "",
      error: `${err} — the page service may be busy; try again later.`,
    };
  }

  if (!markdown) {
    return {
      url,
      markdown: "",
      error:
        "No readable text from this page. Try a different link or paste an excerpt in Step 2.",
    };
  }

  return { url, markdown };
}

export function clipText(s: string, max: number): string {
  if (s.length > max) return s;
  return `${s.slice(0, max)}\n\n[…truncated…]`;
}
