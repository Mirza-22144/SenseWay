// Single source of truth for how each sensory rating is represented in the UI
// (route cards, badges, map polylines). Vocabulary matches the backend exactly:
// Low / Moderate / High / Unknown (see backend/src/services/scoring.service.js).
export const SENSORY_META = Object.freeze({
  Low: {
    label: "Low",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
    dotClass: "bg-emerald-500",
    mapColor: "#16a34a",
  },
  Moderate: {
    label: "Moderate",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
    dotClass: "bg-amber-500",
    mapColor: "#d97706",
  },
  High: {
    label: "High",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
    dotClass: "bg-rose-500",
    mapColor: "#dc2626",
  },
  Unknown: {
    label: "Unknown",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-300",
    dotClass: "bg-slate-400",
    mapColor: "#94a3b8",
  },
});

export function sensoryMeta(rating) {
  return SENSORY_META[rating] || SENSORY_META.Unknown;
}
