// Single source of truth for how each sensory rating is represented in the UI
// (chips, map legend, map polylines). Vocabulary matches the backend exactly:
// Low / Moderate / High / Unknown (see backend/src/services/scoring.service.js).
// Values match the Figma design tokens (Senseway - IE).
export const SENSORY_META = Object.freeze({
  Low: {
    label: "Low",
    chipClass: "bg-success-subtle text-success-ink",
    textClass: "text-success-ink",
    dotClass: "bg-success",
    mapColor: "#2e7050",
  },
  Moderate: {
    label: "Moderate",
    chipClass: "bg-warning-subtle text-warning-ink",
    textClass: "text-warning-ink",
    dotClass: "bg-warning",
    mapColor: "#d97706",
  },
  High: {
    label: "High",
    chipClass: "bg-danger-subtle text-danger-ink",
    textClass: "text-danger-ink",
    dotClass: "bg-danger",
    mapColor: "#b91c1c",
  },
  Unknown: {
    label: "Unknown",
    chipClass: "bg-subtle text-muted",
    textClass: "text-muted",
    dotClass: "bg-subtle border border-line",
    mapColor: "#94a3b8",
  },
});

export function sensoryMeta(rating) {
  return SENSORY_META[rating] || SENSORY_META.Unknown;
}
