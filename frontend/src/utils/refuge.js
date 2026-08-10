// Default icon by refuge type (photoUrl is always null - no photos in the data).
const TYPE_ICONS = {
  Library: "📚",
  Park: "🌳",
  "Quiet cafe": "☕",
  "Gallery or museum": "🖼️",
  "Place of worship": "⛪",
  "Community hall": "🏛️",
  Theatre: "🎭",
};

export function refugeIcon(refuge) {
  return TYPE_ICONS[refuge.refugeType] || "📍";
}

export function refugeTypeLabel(refuge) {
  return refuge.refugeType || "Public space";
}
