"use strict";

const scoring = require("./scoring.service");

/**
 * Pure, dependency-light helpers that turn scored segments into the per-route
 * fields the frontend needs to pick the right AC exception message without
 * guessing. Exported individually so each can be unit-tested in isolation.
 *
 * The guiding principle (from the acceptance criteria): every exception in the
 * document is a UI message, and the frontend can only choose the right one if
 * the backend tells it which state applies. These helpers compute those states.
 */

// AC 1.1.1: show a genuine spread of risk levels, not just the calmest
// handful, so a user can compare "safe" against "fast but crowded" - up to
// this many of the calmest Low routes, plus the calmest available Moderate
// route, plus the calmest available High route. Applied AFTER calmest-first
// ranking, per band.
const MAX_LOW_ROUTES = 3;
const MAX_MODERATE_ROUTES = 1;
const MAX_HIGH_ROUTES = 1;

// AC 1.2.3: "within a reasonable extra walking time". Named and configurable so
// the team can tune "reasonable" in one place; surfaced in the response as
// alternativeMaxExtraMinutes.
const ALTERNATIVE_MAX_EXTRA_MINUTES = 10;

// A live route segment is considered "covered" only if a pedestrian sensor is
// within this distance of it. Beyond this we have no basis to score the segment,
// so it is Unknown / neutral-grey (AC 1.2.1), never guessed.
const COVERAGE_RADIUS_METRES = 150;

/**
 * Per-segment rating and the four-state distance breakdown for a route.
 *
 * Each segment must already carry:
 *   - hasLiveData: boolean  (false => uncovered, AC 1.2.1 neutral grey)
 *   - crowdScore: number|null (null when uncovered - never score the uncovered)
 *   - lengthMetres: number
 *
 * Returns the four buckets (which sum to the route's total covered+uncovered
 * length) plus totals.
 */
function distanceBuckets(segments) {
  const buckets = {
    highCrowdDistanceMetres: 0,
    moderateCrowdDistanceMetres: 0,
    lowCrowdDistanceMetres: 0,
    noDataDistanceMetres: 0,
  };

  for (const s of segments) {
    const len = Number(s.lengthMetres) || 0;
    const rating = segmentRating(s);
    if (rating === scoring.RATING_HIGH) buckets.highCrowdDistanceMetres += len;
    else if (rating === scoring.RATING_MODERATE)
      buckets.moderateCrowdDistanceMetres += len;
    else if (rating === scoring.RATING_LOW) buckets.lowCrowdDistanceMetres += len;
    else buckets.noDataDistanceMetres += len; // Unknown / uncovered
  }

  // Round each bucket; totalMetres is their sum so the invariant holds exactly.
  for (const k of Object.keys(buckets)) buckets[k] = Math.round(buckets[k]);
  buckets.totalDistanceMetres =
    buckets.highCrowdDistanceMetres +
    buckets.moderateCrowdDistanceMetres +
    buckets.lowCrowdDistanceMetres +
    buckets.noDataDistanceMetres;
  return buckets;
}

/**
 * A segment's rating: Unknown when it has no live data, otherwise the band of
 * its crowd score. Never returns a coloured rating for an uncovered segment.
 */
function segmentRating(segment) {
  if (!segment.hasLiveData || segment.crowdScore == null) {
    return scoring.RATING_UNKNOWN;
  }
  return scoring.ratingForScore(segment.crowdScore);
}

/**
 * Sensor coverage across a route (AC 1.2.1):
 *   full    - every segment has live data
 *   partial - some do, some don't
 *   none    - no segment has live data ("Our sensor network does not cover this
 *             route.")
 */
function sensorCoverageFor(segments) {
  if (!segments || segments.length === 0) return "none";
  const covered = segments.filter((s) => s.hasLiveData).length;
  if (covered === 0) return "none";
  if (covered === segments.length) return "full";
  return "partial";
}

/**
 * The route's live-data state (AC 1.1.1 / 1.1.2 / 1.2.1):
 *   unavailable - no segment has live data (=> "Live sensory data unavailable" /
 *                 "Detailed sensory data unavailable for this route")
 *   stale       - has live data but older than 30 minutes ("Sensory data may be
 *                 outdated")
 *   live        - has fresh live data
 */
function dataStateFor(segments, dataUpdatedAt, now = new Date()) {
  const hasAnyLive = (segments || []).some((s) => s.hasLiveData);
  if (!hasAnyLive) return "unavailable";
  if (scoring.isStale(dataUpdatedAt, now)) return "stale";
  return "live";
}

// AC 1.1.2's plain-language reason, one fixed sentence per sensory band. We
// deliberately do NOT name a specific street: the real sensor dataset
// (SENSOR_LOCATION) only has internal site codes, never human-readable
// names (see route.service.js's sensorStreet), so a per-street sentence
// would either be empty or leak a code like "Lat224_T" to the user. A
// band-level explanation is honest for every route without depending on
// data we don't have.
const REASON_BY_RATING = {
  Low: "This route has a Low sensory rating because it avoids the busiest pedestrian areas and primarily passes through low-density streets.",
  Moderate:
    "This route has a Moderate sensory rating because it passes through a mix of quieter streets and some moderately busy pedestrian areas.",
  High: "This route has a High sensory rating because it passes through some of the busiest, most crowded pedestrian areas on this route.",
};

/**
 * A complete plain-language sentence the frontend renders verbatim (AC 1.1.2).
 *
 * When there is no live data, the sentence says so rather than claiming a
 * band we can't actually support with data.
 *
 * @param {object} p
 * @param {boolean} p.hasLiveData
 * @param {"Low"|"Moderate"|"High"|"Unknown"|null} p.sensoryRating
 */
function buildRatingReason({ hasLiveData, sensoryRating }) {
  if (!hasLiveData || !REASON_BY_RATING[sensoryRating]) {
    return "Live sensory data is unavailable for this route, so this rating is based on limited information.";
  }
  return REASON_BY_RATING[sensoryRating];
}

/**
 * Choose the quieter alternative (AC 1.2.3).
 *
 * Base of comparison is the FASTEST route - the time-optimal default a user
 * would otherwise take. The quieter alternative is the calmest route that both
 *   (a) is within `maxExtraMinutes` of the fastest route's time, and
 *   (b) actually reduces high-crowd walking distance vs the fastest,
 * choosing the one that reduces high-crowd distance most.
 *
 * Returns null (=> frontend shows "No suitable quieter alternative available")
 * when nothing qualifies, when the fastest route already has no high-crowd
 * distance, or when the recommended route's dataState is "unavailable" (AC
 * 1.2.3: no alternative card without live data).
 *
 * @param {object[]} routes  assembled routes (need routeId, durationMinutes,
 *                           highCrowdDistanceMetres, dataState)
 * @param {object} p
 * @param {object} p.fastest
 * @param {object} p.recommended
 * @param {number} p.maxExtraMinutes
 */
function pickQuieterAlternative(routes, { fastest, recommended, maxExtraMinutes }) {
  if (!fastest || !recommended) return null;
  if (recommended.dataState === "unavailable") return null;
  if (!(fastest.highCrowdDistanceMetres > 0)) return null; // nothing to improve

  const qualifying = routes.filter(
    (r) =>
      r.routeId !== fastest.routeId &&
      r.dataState !== "unavailable" &&
      typeof r.durationMinutes === "number" &&
      r.durationMinutes - fastest.durationMinutes <= maxExtraMinutes &&
      r.highCrowdDistanceMetres < fastest.highCrowdDistanceMetres
  );
  if (qualifying.length === 0) return null;

  // The quieter alternative is the CALMEST qualifying route (lowest crowd
  // score); fewer extra minutes breaks ties. A null score sorts last. This may
  // legitimately equal the recommended route - the calmest route surfaced as
  // the quieter alternative to the time-optimal one.
  qualifying.sort((a, b) => {
    const sa = a.crowdScore == null ? Infinity : a.crowdScore;
    const sb = b.crowdScore == null ? Infinity : b.crowdScore;
    if (sa !== sb) return sa - sb;
    return a.durationMinutes - b.durationMinutes;
  });
  return qualifying[0].routeId;
}

module.exports = {
  MAX_LOW_ROUTES,
  MAX_MODERATE_ROUTES,
  MAX_HIGH_ROUTES,
  ALTERNATIVE_MAX_EXTRA_MINUTES,
  COVERAGE_RADIUS_METRES,
  distanceBuckets,
  segmentRating,
  sensorCoverageFor,
  dataStateFor,
  buildRatingReason,
  pickQuieterAlternative,
};
