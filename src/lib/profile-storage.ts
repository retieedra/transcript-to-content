import type {
  CalibrationItem,
  EvidenceJson,
  VoiceSpecJson,
} from "@/lib/voice-types";

const PROFILE = "t2c_profile_draft";
const CALIBRATION = "t2c_calibration";
const FINAL = "t2c_final_doc";

/** Saved after step 1 (collect). */
export type ProfileDraftBundle = {
  document: string;
  specJson: VoiceSpecJson;
  evidenceJson?: EvidenceJson;
};

export type CalibrationState = {
  items: CalibrationItem[];
  ratings: Array<boolean | null>;
};

export function saveProfileDraft(bundle: ProfileDraftBundle): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROFILE, JSON.stringify(bundle));
  window.localStorage.removeItem(CALIBRATION);
  window.localStorage.removeItem(FINAL);
}

/** Loads structured bundle, or legacy plain-markdown string. */
export function loadProfileDraft(): ProfileDraftBundle | string | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PROFILE);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as unknown;
    if (
      p &&
      typeof p === "object" &&
      "document" in p &&
      "specJson" in p &&
      typeof (p as ProfileDraftBundle).document === "string" &&
      (p as ProfileDraftBundle).specJson &&
      typeof (p as ProfileDraftBundle).specJson === "object"
    ) {
      return p as ProfileDraftBundle;
    }
  } catch {
    /* legacy markdown string */
  }
  return raw;
}

export function saveCalibration(state: CalibrationState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CALIBRATION, JSON.stringify(state));
}

export function loadCalibration(): CalibrationState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(CALIBRATION);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (
      Array.isArray(p.items) &&
      p.items.length > 0 &&
      typeof p.items[0] === "object" &&
      p.items[0] !== null &&
      "text" in (p.items[0] as object)
    ) {
      const items = p.items as CalibrationItem[];
      const ratings = Array.isArray(p.ratings) ? p.ratings : [];
      if (items.length && ratings.length === items.length) {
        return { items, ratings: ratings as Array<boolean | null> };
      }
    }
    /** Legacy: examples: string[] */
    if (Array.isArray(p.examples) && Array.isArray(p.ratings)) {
      const examples = p.examples as string[];
      const ratings = p.ratings as Array<boolean | null>;
      if (examples.length && ratings.length === examples.length) {
        const items: CalibrationItem[] = examples.map((text) => ({
          text,
          bucket: "on_target_easy",
          tests: [],
          length: "medium",
        }));
        return { items, ratings };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function saveFinalDocument(markdown: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FINAL, markdown);
}

export function loadFinalDocument(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(FINAL);
}

export function clearAllProgress(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PROFILE);
  window.localStorage.removeItem(CALIBRATION);
  window.localStorage.removeItem(FINAL);
}
