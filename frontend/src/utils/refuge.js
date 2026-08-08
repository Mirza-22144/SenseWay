// AC 2.1.2 exception: "If the refuge photo is unavailable, display a default
// icon based on refuge type." photoUrl is always null, so this is always the
// path taken — map the backend's refugeType (backend/src/services/refuge.service.js
// deriveRefugeType) to an emoji.
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

// refugeType is already the user-facing label (AC 2.1.1's own example: "Park,
// Library, Quiet cafe, etc."); no need to re-derive it client-side.
export function refugeTypeLabel(refuge) {
  return refuge.refugeType || "Public space";
}

// AC 2.1.2: "Open now" / "Closes at X" text. openingHoursToday is always null
// today (the Landmarks dataset has no hours), so this always falls through to
// the AC's own exception copy — but reads the real field once it's populated.
export function refugeHoursText(refuge) {
  return refuge.openingHoursToday || "Opening hours not available.";
}
