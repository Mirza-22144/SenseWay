"use strict";

const scoring = require("./scoring.service");

// Pure helpers that turn scored segments into the per-route fields the
// frontend needs to pick the right message, without guessing.

// per-band route cap, applied after calmest-first ranking, so the list shows
// a genuine spread ("safe" vs "fast but crowded"), not just the calmest handful
const MAX_LOW_ROUTES = 3;
const MAX_MODERATE_ROUTES = 1;
const MAX_HIGH_ROUTES = 1;

// max extra walking time a "quieter alternative" is allowed to cost
const ALTERNATIVE_MAX_EXTRA_MINUTES = 10;

// a segment counts as "covered" only if a sensor is within this distance -
// beyond it, the segment is Unknown/neutral-grey, never guessed
const COVERAGE_RADIUS_METRES = 150;

// per-band distance totals for a route; segments need hasLiveData, crowdScore
// (null if uncovered), lengthMetres. Buckets sum to totalDistanceMetres.
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

  for (const k of Object.keys(buckets)) buckets[k] = Math.round(buckets[k]);
  buckets.totalDistanceMetres =
    buckets.highCrowdDistanceMetres +
    buckets.moderateCrowdDistanceMetres +
    buckets.lowCrowdDistanceMetres +
    buckets.noDataDistanceMetres;
  return buckets;
}

// Unknown when uncovered, otherwise the band of the segment's crowd score
function segmentRating(segment) {
  if (!segment.hasLiveData || segment.crowdScore == null) {
    return scoring.RATING_UNKNOWN;
  }
  return scoring.ratingForScore(segment.crowdScore);
}

// full: every segment covered / partial: some are / none: no segment covered
function sensorCoverageFor(segments) {
  if (!segments || segments.length === 0) return "none";
  const covered = segments.filter((s) => s.hasLiveData).length;
  if (covered === 0) return "none";
  if (covered === segments.length) return "full";
  return "partial";
}

// unavailable: no live data at all / stale: live but >30min old / live: fresh
function dataStateFor(segments, dataUpdatedAt, now = new Date()) {
  const hasAnyLive = (segments || []).some((s) => s.hasLiveData);
  if (!hasAnyLive) return "unavailable";
  if (scoring.isStale(dataUpdatedAt, now)) return "stale";
  return "live";
}

// one fixed sentence per band - never names a specific street, since
// SENSOR_LOCATION only has internal site codes (e.g. "Lat224_T"), not
// human-readable names
const REASON_BY_RATING = {
  Low: "This route has a Low sensory rating because it avoids the busiest pedestrian areas and primarily passes through low-density streets.",
  Moderate:
    "This route has a Moderate sensory rating because it passes through a mix of quieter streets and some moderately busy pedestrian areas.",
  High: "This route has a High sensory rating because it passes through some of the busiest, most crowded pedestrian areas on this route.",
};

// full sentence the frontend renders verbatim; says so honestly when there's no live data
function buildRatingReason({ hasLiveData, sensoryRating }) {
  if (!hasLiveData || !REASON_BY_RATING[sensoryRating]) {
    return "Live sensory data is unavailable for this route, so this rating is based on limited information.";
  }
  return REASON_BY_RATING[sensoryRating];
}

// picks the calmest route that's within maxExtraMinutes of the fastest AND
// reduces high-crowd distance vs the fastest. Compared against the fastest
// route (the time-optimal default), not the recommended one. Returns null
// (-> "No suitable quieter alternative available") when nothing qualifies.
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

  // calmest qualifying route wins; fewer extra minutes breaks ties
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
