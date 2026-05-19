/**
 * CVSS v3.1 base-score calculator (spec §7.1).
 * Returns score, vector string, and our severity bucket.
 */

export type Metric = "AV" | "AC" | "PR" | "UI" | "S" | "C" | "I" | "A";
export type CvssState = Record<Metric, string>;

export const CVSS_OPTIONS: Record<Metric, { value: string; label: string }[]> = {
  AV: [
    { value: "N", label: "Network" },
    { value: "A", label: "Adjacent" },
    { value: "L", label: "Local" },
    { value: "P", label: "Physical" },
  ],
  AC: [
    { value: "L", label: "Low" },
    { value: "H", label: "High" },
  ],
  PR: [
    { value: "N", label: "None" },
    { value: "L", label: "Low" },
    { value: "H", label: "High" },
  ],
  UI: [
    { value: "N", label: "None" },
    { value: "R", label: "Required" },
  ],
  S: [
    { value: "U", label: "Unchanged" },
    { value: "C", label: "Changed" },
  ],
  C: [
    { value: "N", label: "None" },
    { value: "L", label: "Low" },
    { value: "H", label: "High" },
  ],
  I: [
    { value: "N", label: "None" },
    { value: "L", label: "Low" },
    { value: "H", label: "High" },
  ],
  A: [
    { value: "N", label: "None" },
    { value: "L", label: "Low" },
    { value: "H", label: "High" },
  ],
};

export const DEFAULT_CVSS: CvssState = {
  AV: "N",
  AC: "L",
  PR: "N",
  UI: "N",
  S: "U",
  C: "N",
  I: "N",
  A: "N",
};

const AV = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 } as const;
const AC = { L: 0.77, H: 0.44 } as const;
const UI = { N: 0.85, R: 0.62 } as const;
const CIA = { H: 0.56, L: 0.22, N: 0 } as const;

function prWeight(pr: string, scopeChanged: boolean): number {
  if (pr === "N") return 0.85;
  if (pr === "L") return scopeChanged ? 0.68 : 0.62;
  return scopeChanged ? 0.5 : 0.27; // H
}

// CVSS 3.1 "roundup": smallest 1-decimal value >= input.
function roundup(x: number): number {
  const i = Math.round(x * 100000);
  if (i % 10000 === 0) return i / 100000;
  return (Math.floor(i / 10000) + 1) / 10;
}

export function severityFromScore(score: number): string {
  if (score <= 0) return "informational";
  if (score < 4.0) return "low";
  if (score < 7.0) return "medium";
  if (score < 9.0) return "high";
  return "critical";
}

export function computeCvss(s: CvssState): {
  score: number;
  vector: string;
  severity: string;
} {
  const scopeChanged = s.S === "C";
  const iscBase =
    1 -
    (1 - CIA[s.C as keyof typeof CIA]) *
      (1 - CIA[s.I as keyof typeof CIA]) *
      (1 - CIA[s.A as keyof typeof CIA]);
  const impact = scopeChanged
    ? 7.52 * (iscBase - 0.029) - 3.25 * Math.pow(iscBase - 0.02, 15)
    : 6.42 * iscBase;
  const exploit =
    8.22 *
    AV[s.AV as keyof typeof AV] *
    AC[s.AC as keyof typeof AC] *
    prWeight(s.PR, scopeChanged) *
    UI[s.UI as keyof typeof UI];

  let score: number;
  if (impact <= 0) score = 0;
  else if (scopeChanged) score = roundup(Math.min(1.08 * (impact + exploit), 10));
  else score = roundup(Math.min(impact + exploit, 10));

  const vector = `CVSS:3.1/AV:${s.AV}/AC:${s.AC}/PR:${s.PR}/UI:${s.UI}/S:${s.S}/C:${s.C}/I:${s.I}/A:${s.A}`;
  return { score, vector, severity: severityFromScore(score) };
}

export function parseVector(vector: string | null | undefined): CvssState {
  const out = { ...DEFAULT_CVSS };
  if (!vector) return out;
  for (const part of vector.split("/")) {
    const [k, v] = part.split(":");
    if (k in out && v) out[k as Metric] = v;
  }
  return out;
}
