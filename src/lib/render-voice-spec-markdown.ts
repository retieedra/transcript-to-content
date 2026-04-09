import type { VoiceSpecJson } from "@/lib/voice-types";

/** Deterministic Markdown export from structured voice spec (no LLM). */
export function renderVoiceSpecMarkdown(spec: VoiceSpecJson): string {
  const lines: string[] = [];

  lines.push("# Voice specification");
  lines.push("");
  lines.push(spec.oneLineSummary);
  lines.push("");

  const section = (title: string, body: string[]) => {
    lines.push(`## ${title}`);
    lines.push("");
    if (body.length === 0) {
      lines.push("—");
      lines.push("");
      return;
    }
    for (const b of body) {
      lines.push(`- ${b}`);
    }
    lines.push("");
  };

  section(
    "Core identity",
    spec.coreIdentity.map((s) => s.trim()).filter(Boolean),
  );

  lines.push("## Tone axes");
  lines.push("");
  if (spec.toneAxes.length === 0) {
    lines.push("—");
    lines.push("");
  } else {
    for (const t of spec.toneAxes) {
      const note = t.note?.trim() ? ` — ${t.note.trim()}` : "";
      lines.push(`- **${t.axis}:** ${t.position}${note}`);
    }
    lines.push("");
  }

  section("Diction", spec.diction);
  section("Sentence shape", spec.sentenceShape);
  section("Structure patterns", spec.structurePatterns);
  section("Rhetorical moves", spec.rhetoricalMoves);
  section("Do", spec.dos);
  section("Don't", spec.donts);
  section("Variation knobs", spec.variationKnobs);
  section("Guardrails", spec.guardrails);

  lines.push("## Uncertainties");
  lines.push("");
  if (spec.uncertainties.length === 0) {
    lines.push("—");
  } else {
    for (const u of spec.uncertainties) {
      lines.push(`- ${u}`);
    }
  }
  lines.push("");

  lines.push("## Quick checklist");
  lines.push("");
  lines.push("- Short-form: apply hooks, density, and tone from **Do** / **Guardrails**.");
  lines.push("- Long-form: apply structure, pacing, and transitions from **Structure** / **Sentence shape**.");
  lines.push("- Adjust **Variation knobs** when the piece needs a different register.");
  lines.push("");

  return lines.join("\n").trim() + "\n";
}
