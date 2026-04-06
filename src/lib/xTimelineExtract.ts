/**
 * Extracts post text from a pasted X (Twitter) GraphQL timeline JSON payload
 * (e.g. UserTweets response copied from DevTools). Runs only in the browser
 * or server when the user supplies the JSON; we do not call X APIs.
 */

const MAX_TWEETS = 250;
const MAX_TOTAL_CHARS = 120_000;

function decodeTwitterText(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function tweetId(t: UnknownRecord): string | null {
  const rid = t.rest_id;
  if (typeof rid === "string" && rid) return rid;
  const leg = t.legacy;
  if (isRecord(leg) && typeof leg.id_str === "string" && leg.id_str) {
    return leg.id_str;
  }
  return null;
}

function tweetText(t: UnknownRecord): string {
  const note = t.note_tweet;
  if (isRecord(note)) {
    const ntr = note.note_tweet_results;
    if (isRecord(ntr)) {
      const res = ntr.result;
      if (isRecord(res) && typeof res.text === "string" && res.text.trim()) {
        return decodeTwitterText(res.text);
      }
    }
  }
  const leg = t.legacy;
  if (isRecord(leg) && typeof leg.full_text === "string" && leg.full_text.trim()) {
    return decodeTwitterText(leg.full_text);
  }
  return "";
}

function walkTweets(root: unknown, out: Map<string, string>): void {
  if (root === null || root === undefined) return;

  if (Array.isArray(root)) {
    for (const x of root) walkTweets(x, out);
    return;
  }

  if (!isRecord(root)) return;

  if (root.__typename === "Tweet" && isRecord(root.legacy)) {
    const id = tweetId(root);
    const text = tweetText(root);
    if (id && text && !out.has(id)) {
      out.set(id, text);
      if (out.size >= MAX_TWEETS) return;
    }
  }

  for (const v of Object.values(root)) {
    if (out.size >= MAX_TWEETS) return;
    walkTweets(v, out);
  }
}

export type ExtractXTimelineResult = {
  /** Joined post bodies, ready to append as one sample block. */
  combined: string;
  error: string | null;
  tweetCount: number;
};

/**
 * Parses JSON and collects unique Tweet legacy/note bodies in document order
 * (first-seen wins for duplicates).
 */
export function extractPostsFromXTimelineJson(raw: string): ExtractXTimelineResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { combined: "", error: null, tweetCount: 0 };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return {
      combined: "",
      error:
        "That text is not valid JSON. Copy the full Response body from DevTools (UserTweets or similar), starting with { and ending with }.",
      tweetCount: 0,
    };
  }

  const map = new Map<string, string>();
  walkTweets(parsed, map);

  if (map.size === 0) {
    return {
      combined: "",
      error:
        "No post text was found. This only works with a timeline response that includes Tweet objects (for example the UserTweets GraphQL response).",
      tweetCount: 0,
    };
  }

  const texts = [...map.values()];
  let joined = texts.join("\n\n---\n\n");
  if (joined.length > MAX_TOTAL_CHARS) {
    joined = `${joined.slice(0, MAX_TOTAL_CHARS)}\n\n[truncated]`;
  }

  return {
    combined: joined,
    error: null,
    tweetCount: map.size,
  };
}
