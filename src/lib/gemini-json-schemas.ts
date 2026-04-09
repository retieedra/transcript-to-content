/**
 * JSON Schemas for Gemini `generationConfig.responseSchema` (Gemini API object types).
 * @see https://ai.google.dev/gemini-api/docs/structured-output
 */

const confidenceSchema = {
  type: "STRING",
  enum: ["low", "medium", "high"],
};

const evidenceSnippetSchema = {
  type: "OBJECT",
  properties: {
    sourceId: { type: "STRING" },
    snippet: { type: "STRING" },
  },
  required: ["sourceId", "snippet"],
};

const voiceDimensionItemSchema = {
  type: "OBJECT",
  properties: {
    dimension: { type: "STRING" },
    finding: { type: "STRING" },
    confidence: confidenceSchema,
    evidence: {
      type: "ARRAY",
      items: evidenceSnippetSchema,
    },
  },
  required: ["dimension", "finding", "confidence", "evidence"],
};

const patternItemSchema = {
  type: "OBJECT",
  properties: {
    pattern: { type: "STRING" },
    confidence: confidenceSchema,
    evidence: {
      type: "ARRAY",
      items: evidenceSnippetSchema,
    },
  },
  required: ["pattern", "confidence", "evidence"],
};

const rhetoricalMoveItemSchema = {
  type: "OBJECT",
  properties: {
    move: { type: "STRING" },
    confidence: confidenceSchema,
    evidence: {
      type: "ARRAY",
      items: evidenceSnippetSchema,
    },
  },
  required: ["move", "confidence", "evidence"],
};

const sourceDecisionSchema = {
  type: "OBJECT",
  properties: {
    sourceId: { type: "STRING" },
    include: { type: "BOOLEAN" },
    reason: { type: "STRING" },
  },
  required: ["sourceId", "include", "reason"],
};

/** Call 1: extract voice evidence */
export const EVIDENCE_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    sourceDecisions: {
      type: "ARRAY",
      items: sourceDecisionSchema,
    },
    voiceDimensions: {
      type: "ARRAY",
      items: voiceDimensionItemSchema,
    },
    lexicalPatterns: {
      type: "ARRAY",
      items: patternItemSchema,
    },
    rhetoricalMoves: {
      type: "ARRAY",
      items: rhetoricalMoveItemSchema,
    },
    negativeSignals: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
    uncertainties: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
  },
  required: [
    "sourceDecisions",
    "voiceDimensions",
    "lexicalPatterns",
    "rhetoricalMoves",
    "negativeSignals",
    "uncertainties",
  ],
};

const toneAxisSchema = {
  type: "OBJECT",
  properties: {
    axis: { type: "STRING" },
    position: { type: "STRING" },
    note: { type: "STRING" },
  },
  required: ["axis", "position"],
};

/** Call 2 & 4: reusable voice spec */
export const VOICE_SPEC_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    oneLineSummary: { type: "STRING" },
    coreIdentity: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
    toneAxes: {
      type: "ARRAY",
      items: toneAxisSchema,
    },
    diction: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
    sentenceShape: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
    structurePatterns: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
    rhetoricalMoves: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
    dos: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
    donts: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
    variationKnobs: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
    guardrails: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
    uncertainties: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
  },
  required: [
    "oneLineSummary",
    "coreIdentity",
    "toneAxes",
    "diction",
    "sentenceShape",
    "structurePatterns",
    "rhetoricalMoves",
    "dos",
    "donts",
    "variationKnobs",
    "guardrails",
    "uncertainties",
  ],
};

const bucketEnum = {
  type: "STRING",
  enum: [
    "on_target_easy",
    "on_target_varied",
    "near_miss_too_generic",
    "near_miss_too_formal",
    "near_miss_too_hyped",
    "boundary_test",
  ],
};

const lengthEnum = {
  type: "STRING",
  enum: ["short", "medium", "long"],
};

const calibrationItemSchema = {
  type: "OBJECT",
  properties: {
    text: { type: "STRING" },
    bucket: bucketEnum,
    tests: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
    length: lengthEnum,
  },
  required: ["text", "bucket", "tests", "length"],
};

/** Call 3: calibration items */
export const CALIBRATION_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: calibrationItemSchema,
    },
  },
  required: ["items"],
};
