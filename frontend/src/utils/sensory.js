// Rating -> UI representation (chips, map legend, map polylines).
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
