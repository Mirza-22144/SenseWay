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

// WHY 60 minutes: presenting stale crowd data as if it were current is worse
// than saying nothing, for a user who is choosing a route specifically to avoid
// a sensory ambush. Past this age we downgrade to "Unknown" rather than guess.
const STALE_AFTER_MS = 60 * 60 * 1000;

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
 * Rating that also respects data freshness. If the underlying data is older
 * than STALE_AFTER_MS (or its timestamp is missing/unparseable), we return
 * "Unknown" no matter what the number says.
 *
 * @param {number} score
 * @param {object} [opts]
 * @param {string|Date} [opts.dataUpdatedAt] timestamp of the underlying data
 * @param {Date} [opts.now]
 */
function ratingForFreshScore(score, opts = {}) {
  const now = opts.now instanceof Date ? opts.now : new Date();
  const updated = opts.dataUpdatedAt ? new Date(opts.dataUpdatedAt) : null;

  if (!updated || Number.isNaN(updated.getTime())) {
    // No usable timestamp -> we cannot claim the data is current.
    return score == null ? RATING_UNKNOWN : ratingForScore(score);
  }
  if (now.getTime() - updated.getTime() > STALE_AFTER_MS) {
    return RATING_UNKNOWN;
  }
  return ratingForScore(score);
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
  ratingForFreshScore,
  meanScore,
};
