"use strict";

// Sensory scoring rules, in one place - pure functions, no DB/network, so
// every layer calls this instead of reimplementing it. Vocabulary is always
// Low / Moderate / High / Unknown, never "Medium".

// bands are inclusive of the low end: 0-30 Low, 31-70 Moderate, 71-100 High
const SENSORY_BANDS = Object.freeze([
  { rating: "Low", min: 0, max: 30 },
  { rating: "Moderate", min: 31, max: 70 },
  { rating: "High", min: 71, max: 100 },
]);

const RATING_LOW = "Low";
const RATING_MODERATE = "Moderate";
const RATING_HIGH = "High";
const RATING_UNKNOWN = "Unknown";

// freshness horizon - data older than this is "stale" but STILL shown with a
// rating + warning (dataState), not blanked to "Unknown". "Unknown" is only
// for segments/routes with no live data at all.
const STALE_AFTER_MS = 30 * 60 * 1000;

// score -> rating; "Unknown" for missing/out-of-range rather than a guess
function ratingForScore(score) {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return RATING_UNKNOWN;
  }
  if (score < 0 || score > 100) return RATING_UNKNOWN;
  const band = SENSORY_BANDS.find((b) => score >= b.min && score <= b.max);
  return band ? band.rating : RATING_UNKNOWN;
}

// true if dataUpdatedAt is older than staleAfterMs, or missing/unparseable
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
