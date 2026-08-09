export function formatDistance(metres) {
  if (typeof metres !== "number" || !Number.isFinite(metres)) return "—";
  if (metres >= 1000) return `${(metres / 1000).toFixed(1)} km`;
  return `${Math.round(metres)} m`;
}

export function formatDuration(minutes) {
  if (typeof minutes !== "number" || !Number.isFinite(minutes)) return "—";
  return `${Math.round(minutes)} min`;
}

// AC 1.2.3: "+4 min" trade-off phrasing for a quieter alternative's extra time.
export function formatSignedMinutes(minutes) {
  if (typeof minutes !== "number" || !Number.isFinite(minutes)) return "—";
  const rounded = Math.round(minutes);
  if (rounded <= 0) return "No extra time";
  return `+${rounded} min`;
}

export function formatTimestamp(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
