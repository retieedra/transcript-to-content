export type EvidenceJson = {
  sourceDecisions: {
    sourceId: string;
    include: boolean;
    reason: string;
  }[];
  voiceDimensions: {
    dimension: string;
    finding: string;
    confidence: "low" | "medium" | "high";
    evidence: { sourceId: string; snippet: string }[];
  }[];
  lexicalPatterns: {
    pattern: string;
    confidence: "low" | "medium" | "high";
    evidence: { sourceId: string; snippet: string }[];
  }[];
  rhetoricalMoves: {
    move: string;
    confidence: "low" | "medium" | "high";
    evidence: { sourceId: string; snippet: string }[];
  }[];
  negativeSignals: string[];
  uncertainties: string[];
};

export type VoiceSpecJson = {
  oneLineSummary: string;
  coreIdentity: string[];
  toneAxes: { axis: string; position: string; note?: string }[];
  diction: string[];
  sentenceShape: string[];
  structurePatterns: string[];
  rhetoricalMoves: string[];
  dos: string[];
  donts: string[];
  variationKnobs: string[];
  guardrails: string[];
  uncertainties: string[];
};

export type CalibrationBucket =
  | "on_target_easy"
  | "on_target_varied"
  | "near_miss_too_generic"
  | "near_miss_too_formal"
  | "near_miss_too_hyped"
  | "boundary_test";

export type CalibrationItem = {
  text: string;
  bucket: CalibrationBucket;
  tests: string[];
  length: "short" | "medium" | "long";
};

export type CalibrationJson = {
  items: CalibrationItem[];
};

export type SourceManifestEntry = {
  sourceId: string;
  type: "pdf" | "tweet_archive" | "pasted_text";
  label: string;
};
