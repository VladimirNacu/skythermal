import type { DecisionStatus } from "@/api/types";

export const DECISION_COLOR: Record<DecisionStatus, string> = {
  GO: "var(--decision-go)",
  MAYBE: "var(--decision-maybe)",
  NO_GO: "var(--decision-no-go)",
  UNKNOWN: "var(--decision-no-data)",
};

export const DECISION_LABEL: Record<DecisionStatus, string> = {
  GO: "GO",
  MAYBE: "MAYBE",
  NO_GO: "NO-GO",
  UNKNOWN: "NO DATA",
};

/** Map a wind speed (km/h) to the SkyThermal ramp. */
export function windColor(kmh: number): string {
  const stops: [number, string][] = [
    [0, "#267bd4"],
    [10, "#1cc0b2"],
    [20, "#59c55a"],
    [30, "#d2bd32"],
    [40, "#f1852d"],
    [50, "#dd484a"],
    [60, "#c33190"],
    [80, "#732bce"],
  ];
  let chosen = stops[0][1];
  for (const [threshold, color] of stops) {
    if (kmh >= threshold) chosen = color;
  }
  return chosen;
}

/** Marker tint bucket from a decision status. */
export function markerTint(status: DecisionStatus): "green" | "orange" | "red" | "grey" {
  switch (status) {
    case "GO": return "green";
    case "MAYBE": return "orange";
    case "NO_GO": return "red";
    default: return "grey";
  }
}
