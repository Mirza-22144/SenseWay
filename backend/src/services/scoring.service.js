"use strict";

/**
 * The sensory scoring rules, in ONE place.
 *
 * WHY a pure function with no DB, no network and no Express: this is the single
 * most important piece of product logic (the whole app exists to turn a crowd
 * number into "is this calm enough for Freddy"). Keeping it pure means the data
 * team can unit-test it in isolation, reason about it, and change the bands
 * without touching HTTP or SQL. Every layer that needs a rating calls THIS.
 *
 * Vocabulary is Low / Moderate / High / Unknown. Never "Medium" - the team's
 * acceptance criteria say Moderate, so the API says Moderate.
 */

// Exported so the data team can retune bands in exactly one edit.
// Bands are inclusive of the low end: 0-30 Low, 31-70 Moderate, 71-100 High.
const SENSORY_BANDS = Object.freeze([
  { rating: "Low", min: 0, max: 30 },
  { rating: "Moderate", min: 31, max: 70 },
  { rating: "High", min: 71, max: 100 },
]);

const RATING_LOW = "Low";
const RATING_MODERATE = "Moderate";
const RATING_HIGH = "High";
const RATING_UNKNOWN = "Unknown";

// AC 1.1.2: "If the data is older than 30 minutes, display 'Sensory data may be
// outdated.'" So 30 minutes - not 60 - is the freshness horizon.
//
// NOTE on behaviour (this changed to follow the signed-off AC): stale data does
// NOT become "Unknown". AC 1.1.2 keeps the rating visible and adds an "outdated"
// warning. So staleness is surfaced via the route's `dataState` ("stale"),
// while the numeric rating is still shown. "Unknown" is reserved for segments/
// routes with no live sensor data at all (AC 1.2.1's neutral-grey state).
const STALE_AFTER_MS = 30 * 60 * 1000;

/**
 * Map a numeric crowd score (0-100) to a rating. Returns "Unknown" when the
 * score is missing or out of range rather than clamping to a confident label.
 */
function ratingForScore(score) {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return RATING_UNKNOWN;
  }
  if (score < 0 || score > 100) return RATING_UNKNOWN;
  const band = SENSORY_BANDS.find((b) => score >= b.min && score <= b.max);
  return band ? band.rating : RATING_UNKNOWN;
}

/**
 * Is the underlying data older than the freshness horizon (or missing a usable
 * timestamp)? Used to drive the route-level `dataState` of "stale". Kept
 * separate from the rating, per AC 1.1.2, so a stale route still shows its
 * colour with a warning rather than going blank.
 *
 * @param {string|Date} dataUpdatedAt
 * @param {Date} [now]
 * @param {number} [staleAfterMs]
 */
function isStale(dataUpdatedAt, now = new Date(), staleAfterMs = STALE_AFTER_MS) {
  const updated = dataUpdatedAt ? new Date(dataUpdatedAt) : null;
  if (!updated || Number.isNaN(updated.getTime())) return true;
  return now.getTime() - updated.getTime() > staleAfterMs;
}

/** Average of an array of segment crowd scores, rounded. Null for empty. */
function meanScore(scores) {
  const nums = (scores || []).filter(
    (n) => typeof n === "number" && Number.isFinite(n)
  );
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

module.exports = {
  SENSORY_BANDS,
  STALE_AFTER_MS,
  RATING_LOW,
  RATING_MODERATE,
  RATING_HIGH,
  RATING_UNKNOWN,
  ratingForScore,
  isStale,
  meanScore,
};
