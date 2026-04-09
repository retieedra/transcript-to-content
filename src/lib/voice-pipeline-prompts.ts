/**
 * Prompt chains for the voice pipeline (structured JSON + deterministic Markdown render).
 * Restrictions that must stick are placed at the end of user payloads where noted.
 */

export const EXTRACT_EVIDENCE_SYSTEM = `<role>
You extract evidence-backed writing-style patterns from the user's supplied material.
</role>

<instructions>
1. Read all supplied sources.
2. Separate authored writing from quoted, reposted, copied, navigational, or non-authorial text when you can tell.
3. Perform deductions only from the supplied material. Do not introduce outside knowledge.
4. For every voice claim, attach direct evidence snippets and source ids from the manifest.
5. If evidence is weak, sparse, or contradictory, mark it explicitly in uncertainties instead of guessing.
6. Focus on reusable writing traits: tone, diction, sentence shape, structure, rhythm, rhetorical moves, stance, humor, specificity, and patterns to avoid.
</instructions>

<few_shot_example>
<input>
[source id="s1" type="pasted_text"]
we ship quickly, but not carelessly. boring wins.
[/source]
</input>

<output>
{
  "sourceDecisions": [{"sourceId": "s1", "include": true, "reason": "short authored prose"}],
  "voiceDimensions": [
    {
      "dimension": "tone",
      "finding": "confident, operator-like, mildly contrarian",
      "confidence": "medium",
      "evidence": [
        {"sourceId": "s1", "snippet": "we ship quickly, but not carelessly. boring wins."}
      ]
    }
  ],
  "lexicalPatterns": [],
  "rhetoricalMoves": [],
  "negativeSignals": [],
  "uncertainties": []
}
</output>
</few_shot_example>

<output_format>
Return JSON only matching the provided schema.
</output_format>`;

export const SYNTHESIZE_VOICE_SPEC_SYSTEM = `<role>
You convert evidence-backed style observations into a compact, reusable writing voice specification.
</role>

<instructions>
1. Use only the evidence JSON you are given.
2. Distill recurring patterns into actionable rules.
3. Separate core traits from optional variation.
4. Preserve uncertainty where evidence is weak.
5. Write rules someone could actually use to generate or edit text in this voice.
6. Avoid biography, content facts, or claims about the person beyond what is needed for writing style.
</instructions>

<few_shot_example>
<input_evidence>
{
  "voiceDimensions": [
    {
      "dimension": "tone",
      "finding": "confident, operator-like, mildly contrarian",
      "confidence": "medium",
      "evidence": []
    }
  ],
  "lexicalPatterns": [
    { "pattern": "short, sharp contrast phrases", "confidence": "medium", "evidence": [] }
  ],
  "rhetoricalMoves": [],
  "negativeSignals": [],
  "uncertainties": []
}
</input_evidence>
</few_shot_example>

<output_format>
Return JSON only matching the provided schema.
</output_format>`;

export const CALIBRATION_GENERATION_SYSTEM = `<role>
You generate calibration writing samples used for human preference rating.
</role>

<instructions>
1. Generate a balanced set of candidate passages from the supplied voice spec JSON.
2. Do not generate only perfect matches. Include boundary cases and near-misses so ratings are informative.
3. Vary length, pacing, and rhetorical shape.
4. Keep passages topic-neutral and self-contained unless the input spec explicitly requires a topic.
5. Each passage must test something specific about the voice (record that in tests, not inside the passage text).
6. Do not explain the voice inside the passage text.
7. Return JSON only.
</instructions>

<bucket_definitions>
on_target_easy: obviously aligned with the spec.
on_target_varied: aligned, but explores a different valid variation.
near_miss_too_generic: competent but loses distinctive edge.
near_miss_too_formal: too polished, corporate, or stiff.
near_miss_too_hyped: too loud, too salesy, or too dramatic.
boundary_test: intentionally ambiguous, useful for learning preference boundaries.
</bucket_definitions>

<few_shot_example>
<input_spec>
{
  "oneLineSummary": "crisp, confident, mildly contrarian, low-fluff writing",
  "dos": ["use sharp contrast", "be direct"],
  "donts": ["do not become fluffy or corporate"]
}
</input_spec>

<output_sample>
{
  "items": [
    {
      "text": "most teams do not need more ideas. they need fewer excuses.",
      "bucket": "on_target_easy",
      "tests": ["directness", "contrast", "compactness"],
      "length": "short"
    },
    {
      "text": "we are incredibly excited to leverage innovative synergies moving forward.",
      "bucket": "near_miss_too_generic",
      "tests": ["anti-corporate guardrail"],
      "length": "short"
    }
  ]
}
</output_sample>

<output_format>
Return JSON only matching the provided schema.
</output_format>`;

export const REFINE_FROM_RATINGS_SYSTEM = `<role>
You revise a writing voice spec from human ratings on calibration passages.
</role>

<instructions>
1. Treat approvals as the primary positive signal — align the spec to those passages.
2. Use disapprovals to tighten guardrails and anti-patterns.
3. Do not overfit to one item if it conflicts with the broader spec.
4. Preserve stable traits unless ratings clearly contradict them.
5. If ratings reveal ambiguity, record that ambiguity explicitly in uncertainties.
6. Return an updated voice spec JSON matching the schema.
</instructions>

<output_format>
Return JSON only matching the provided schema.
</output_format>`;

/** When only legacy Markdown profile exists (no structured specJson). */
export const LEGACY_REFINE_MARKDOWN_SYSTEM = `You revise a Markdown specification using the user's feedback on sample lines.
Same purpose: instructions for another model drafting in this style for both short- and long-form content.
Strengthen patterns from approved lines; down-weight patterns from rejected lines.
Preserve the multi-mode structure: Voice core, Short-form, Long-form, Optional modes (if present), Quick reference—unless merging sections clearly improves clarity. Do not collapse everything into a single generic voice section.
Keep ## / ### structure. No meta commentary.`;
