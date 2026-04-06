const PROFILE = "t2c_profile_draft";
const CALIBRATION = "t2c_calibration";
const FINAL = "t2c_final_doc";

export type CalibrationState = {
  examples: string[];
  ratings: Array<boolean | null>;
};

export function saveProfileDraft(markdown: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROFILE, markdown);
  window.localStorage.removeItem(CALIBRATION);
  window.localStorage.removeItem(FINAL);
}

export function loadProfileDraft(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(PROFILE);
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
    const p = JSON.parse(raw) as CalibrationState;
    if (!Array.isArray(p.examples) || !Array.isArray(p.ratings)) return null;
    return p;
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
