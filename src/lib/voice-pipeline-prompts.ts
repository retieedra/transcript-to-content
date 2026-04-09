/**
 * Three-phase voice spec pipeline (prompts only; routes call Gemini in order).
 *
 * 1. Draft from sources — PDFs + optional tweet/paste text only. No ratings yet.
 * 2. Calibration samples — short texts derived from that draft, with controlled variation.
 * 3. Final spec — revise draft using thumbs-up as the main positive signal; thumbs-down as constraints.
 */

export const PHASE1_DRAFT_FROM_SOURCES_SYSTEM = `You write a single Markdown document for another model to read before drafting text on the author's behalf.

Phase 1 (this step): Ground the spec ONLY in the source materials provided (PDFs, optional tweet archives, optional pasted excerpts). Infer voice, cadence, diction, and structure from what is actually there. Do not invent strong preferences the sources do not support. If something is unclear, say so briefly rather than guessing.

The author may write anything from tweets to essays: the spec must support multiple content shapes, not only one length.

Required structure (use these ## headings in order, adapt wording to the author):
1. ## Voice core — shared habits that show up everywhere (cadence, diction, punctuation, register, recurring moves). Concrete; paraphrase—don't paste long quotes from the sources.
2. ## Short-form — posts, replies, one-liners, bullets, tight CTAs: how length, hooks, and tone shift vs long-form; what to preserve and what to strip.
3. ## Long-form — essays, letters, memos, talks: structure, pacing, how paragraphs open and close, sign-offs, depth.
4. ## Optional modes (if the sources support it) — e.g. email vs essay vs thread; give 2–4 labeled options ("When writing X, do Y"). If the sources don't show variation, infer cautiously and say what's assumed.
5. ## Quick reference — a compact bullet list: "short / long / other" pick-one reminders for a model under time pressure.

Use ### subheadings inside sections where helpful. Stay concrete; no fluff.
End with a short checklist that explicitly mentions both short- and long-form use.`;

export function phase2CalibrationSamplesSystem(count: number): string {
  return `Phase 2 (this step): The user already has a draft voice specification (from their uploads). Your job is to write NEW sample passages that follow that specification — not to quote or summarize their source files.

Goals:
- Every passage must plausibly match the draft spec below.
- Use neutral or generic topics (no need to match the author's subject matter).
- Include intentional variation so the user can compare: vary energy (punchy vs measured), slightly different sentence shapes, and mix short vs long as specified.
- About half the passages: short (one to three sentences, or social-length).
- About half: longer (one short paragraph, roughly 4–8 sentences, essay or email body).

Reply with exactly ${count} passages. Separate each passage with a line containing only three dashes: ---
No numbering, no section labels, no introduction—just passages and --- between them.`;
}

export const PHASE3_REFINE_FROM_RATINGS_SYSTEM = `Phase 3 (this step): Revise the Markdown voice specification using the user's thumbs-up / thumbs-down on sample lines.

Priority order:
1. **Thumbs-up lines are the strongest signal.** Treat them as ground truth for how the final voice should sound. Expand, reinforce, and align the whole spec (especially Voice core, Short-form, and Quick reference) with the patterns in approved lines: rhythm, diction, punctuation habits, warmth or distance, humor, directness.
2. **Thumbs-down lines** tell you what to avoid or soften. Remove or narrow patterns that show up in rejections, but do not let one or two rejections erase patterns that many approvals support.
3. Preserve the multi-mode structure: Voice core, Short-form, Long-form, Optional modes (if present), Quick reference—unless merging sections clearly improves clarity. Do not collapse everything into a single generic voice section.

Same purpose as before: instructions for another model drafting in this style for both short- and long-form content.
Keep ## / ### structure. No meta commentary about "phase" or "the user."`;
