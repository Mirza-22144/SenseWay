"use strict";

const google = require("./google.service");
const pedestrian = require("./pedestrian.service");
const refuge = require("./refuge.service");
const scoring = require("./scoring.service");
const metrics = require("./routeMetrics");
const { countToCrowdScore } = require("../utils/crowd");
const { haversineMetres } = require("../utils/geo");
const { melbourneParts } = require("../utils/time");

/**
 * Orchestrates one route recommendation (US1.1 / US1.2).
 *
 * The calmest-first ordering is the ENTIRE product, so it lives here, applied
 * identically to mock and live candidates. This service composes the
 * google/pedestrian/refuge services, the pure scoring service, and the pure
 * routeMetrics helpers - it does not talk to the DB or Google directly.
 *
 * Every per-route state the frontend keys an AC message off (dataState,
 * sensorCoverage, the four distance buckets, ratingReason, the quieter
 * alternative) is computed here so the frontend never has to guess which
 * exception message applies.
 */

// How many walking minutes of refuges to attach near the start point.
const REFUGE_LOOKUP_MINUTES = 5;

// A segment at/above this score is a "congestion point" worth surfacing,
// independent of the user's personal avoidance threshold.
const CONGESTION_POINT_SCORE = 71;

async function recommend(request) {
  const { start, destination, departureTime, preferences } = request;
  const threshold = preferences.crowdThreshold;
  const now = new Date();

  // 1. Candidate geometry (live Google or mock). Empty => no routes exist.
  const { candidates, source: googleSource } = await google.getCandidateRoutes(
    start,
    destination
  );

  // 2. Ensure every candidate has scored segments. Mock candidates already do;
  //    live candidates get scored (with coverage) here from pedestrian data.
  let pedestrianSource = null;
  for (const c of candidates) {
    if (!c.dataUpdatedAt) c.dataUpdatedAt = now.toISOString();
    if (c.segments && c.segments.length && c.segments[0].lengthMetres != null) {
      continue; // mock candidate: fully formed
    }
    const enriched = await scoreLiveCandidate(c, departureTime, now);
    pedestrianSource = mergeSource(pedestrianSource, enriched.pedestrianSource);
    Object.assign(c, enriched.candidateFields);
  }

  // 3. Assemble full route objects (no cross-route fields yet).
  const assembled = candidates.map((c) => assembleBase(c, { threshold, now }));

  // 4. Rank calmest-first, cap to three, and compute cross-route fields.
  const finalized = finalizeRoutes(assembled, {
    maxRoutes: metrics.MAX_ROUTES,
    maxExtraMinutes: metrics.ALTERNATIVE_MAX_EXTRA_MINUTES,
  });
  const routes = finalized.routes;

  // 5. AC 1.1.1 / 2.1.3: no routes is a normal outcome, not a 500. We return
  //    200 with an empty routes array and an explicit flag; the frontend picks
  //    "No routes available for these locations." or "Unable to generate
  //    directions to this refuge." from context.
  const noRoutesAvailable = routes.length === 0;

  // 6. noLowSensoryRouteAvailable (US1.2 AC2): true when EVERY route has at
  //    least one covered segment over the user's threshold.
  const noLowSensoryRouteAvailable =
    routes.length > 0 &&
    routes.every((r) => r.segments.some((s) => s.exceedsThreshold));

  const notice = noLowSensoryRouteAvailable
    ? "Every available route crosses at least one area above your crowd threshold. " +
      "We've recommended the calmest of them, but none avoids high density entirely."
    : null;

  // 7. Refuge spaces near the start.
  const refugeResult = await refuge.findNearby(
    start.latitude,
    start.longitude,
    REFUGE_LOOKUP_MINUTES
  );

  return {
    query: request,
    noRoutesAvailable,
    recommendedRouteId: finalized.recommendedRouteId,
    fastestRouteId: finalized.fastestRouteId,
    quieterAlternativeRouteId: finalized.quieterAlternativeRouteId,
    alternativeMaxExtraMinutes: metrics.ALTERNATIVE_MAX_EXTRA_MINUTES,
    noLowSensoryRouteAvailable,
    notice,
    routes,
    refugeSpaces: refugeResult.refuges,
    dataUpdatedAt: now.toISOString(),
    dataSource: resolveDataSource(googleSource, pedestrianSource),
  };
}

/**
 * Turn a raw candidate (with scored, coverage-aware segments) into a full route
 * object, minus the cross-route trade-off fields (added in finalizeRoutes).
 * Exported so the reroute service can reuse the exact same shape.
 */
function assembleBase(candidate, { threshold, now }) {
  const rawSegments = candidate.segments || [];
  const dataUpdatedAt = candidate.dataUpdatedAt || now.toISOString();

  // Covered segments only feed the route score - we never average in a segment
  // we couldn't measure.
  const covered = rawSegments.filter(
    (s) => s.hasLiveData && typeof s.crowdScore === "number"
  );
  const crowdScore = scoring.meanScore(covered.map((s) => s.crowdScore));
  const peakSegment = covered.reduce(
    (best, s) => (best == null || s.crowdScore > best.crowdScore ? s : best),
    null
  );
  const peakSegmentScore = peakSegment ? peakSegment.crowdScore : null;

  const dataState = metrics.dataStateFor(rawSegments, dataUpdatedAt, now);
  const sensorCoverage = metrics.sensorCoverageFor(rawSegments);
  const sensoryRating = scoring.ratingForScore(crowdScore); // Unknown if null

  const buckets = metrics.distanceBuckets(rawSegments);

  const segments = rawSegments.map((s, i) => ({
    segmentId: `${candidate.routeId}-seg-${i + 1}`,
    fromLatitude: s.fromLatitude,
    fromLongitude: s.fromLongitude,
    toLatitude: s.toLatitude,
    toLongitude: s.toLongitude,
    lengthMetres: Math.round(s.lengthMetres || 0),
    // Uncovered segments carry NO crowd score and are Unknown / neutral-grey.
    hasLiveData: Boolean(s.hasLiveData),
    crowdScore: s.hasLiveData && typeof s.crowdScore === "number" ? s.crowdScore : null,
    sensoryRating: metrics.segmentRating(s),
    exceedsThreshold:
      Boolean(s.hasLiveData) &&
      typeof s.crowdScore === "number" &&
      s.crowdScore > threshold,
  }));

  const ratingReason = metrics.buildRatingReason({
    hasLiveData: dataState !== "unavailable",
    peakSegment,
    historicalPeakScore:
      candidate.historicalPeakScore != null
        ? candidate.historicalPeakScore
        : null,
  });

  // "high" only when we have a fresh, known rating; "low" otherwise. dataState
  // is the richer signal, but confidence is kept for backward compatibility.
  const confidence =
    crowdScore != null && dataState === "live" ? "high" : "low";

  // bypassedAreas are only the high-density areas actually above the user's
  // threshold.
  const bypassedAreas = (candidate.bypassedAreas || []).filter(
    (a) => typeof a.crowdScore === "number" && a.crowdScore > threshold
  );

  return {
    routeId: candidate.routeId,
    summary: candidate.summary,
    durationMinutes: candidate.durationMinutes,
    distanceMetres: buckets.totalDistanceMetres,
    // cross-route fields, filled by finalizeRoutes:
    minutesSlowerThanFastest: null,
    minutesSlowerThanRecommended: null,
    highCrowdDistanceSavedMetres: null,
    polyline: candidate.polyline,
    crowdScore,
    sensoryRating,
    ratingReason,
    dataState,
    sensorCoverage,
    confidence,
    dataUpdatedAt,
    // Four-state distance breakdown (AC 1.2.1 legend / AC 1.2.2 summary).
    highCrowdDistanceMetres: buckets.highCrowdDistanceMetres,
    moderateCrowdDistanceMetres: buckets.moderateCrowdDistanceMetres,
    lowCrowdDistanceMetres: buckets.lowCrowdDistanceMetres,
    noDataDistanceMetres: buckets.noDataDistanceMetres,
    contributingFactors: {
      pedestrianDensity: {
        averageCountPerHour:
          candidate.averageCountPerHour != null
            ? candidate.averageCountPerHour
            : null,
        peakSegmentScore,
      },
      sensorsUsed: candidate.sensorsUsed || [],
      congestionPoints: candidate.congestionPoints || [],
    },
    segments,
    bypassedAreas,
    alerts: [],
  };
}

/**
 * Rank calmest-first, cap to maxRoutes, then compute the cross-route trade-off
 * fields and the quieter alternative. Shared by recommend() and reroute.
 */
function finalizeRoutes(routeObjs, { maxRoutes, maxExtraMinutes }) {
  const sorted = routeObjs.slice().sort(byCalmestThenFastest);
  const routes = sorted.slice(0, maxRoutes);

  if (routes.length === 0) {
    return {
      routes,
      recommendedRouteId: null,
      fastestRouteId: null,
      quieterAlternativeRouteId: null,
    };
  }

  const recommended = routes[0]; // calmest
  const fastest = routes.reduce((best, r) =>
    best == null || r.durationMinutes < best.durationMinutes ? r : best,
    null
  );

  for (const r of routes) {
    r.minutesSlowerThanFastest = r.durationMinutes - fastest.durationMinutes;
    r.minutesSlowerThanRecommended =
      r.durationMinutes - recommended.durationMinutes;
    r.highCrowdDistanceSavedMetres = Math.max(
      0,
      fastest.highCrowdDistanceMetres - r.highCrowdDistanceMetres
    );
  }

  const quieterAlternativeRouteId = metrics.pickQuieterAlternative(routes, {
    fastest,
    recommended,
    maxExtraMinutes,
  });

  return {
    routes,
    recommendedRouteId: recommended.routeId,
    fastestRouteId: fastest.routeId,
    quieterAlternativeRouteId,
  };
}

// Calmest first (lower crowdScore wins); a null score sorts last; ties broken by
// shorter duration.
function byCalmestThenFastest(a, b) {
  const sa = a.crowdScore == null ? Infinity : a.crowdScore;
  const sb = b.crowdScore == null ? Infinity : b.crowdScore;
  if (sa !== sb) return sa - sb;
  return (a.durationMinutes || Infinity) - (b.durationMinutes || Infinity);
}

/**
 * Score a live Google candidate segment-by-segment from pedestrian data,
 * respecting sensor coverage: a segment with no sensor within
 * COVERAGE_RADIUS_METRES is left UNSCORED (hasLiveData false), never guessed.
 * Only runs on the live path; not covered by the mock test suite (see README).
 */
async function scoreLiveCandidate(candidate, departureTime, now) {
  const points = Array.isArray(candidate.points) ? candidate.points : [];
  const sampled = samplepoints(points, 6);
  const { dayOfWeek, hour } = melbourneParts(departureTime || now);

  const segments = [];
  const sensorsUsed = [];
  const seenSensors = new Set();
  const congestionPoints = [];
  const counts = [];
  let oldestObservedAt = null;
  let pedestrianSource = null;
  let peakCovered = null;

  for (let i = 0; i < sampled.length - 1; i += 1) {
    const from = sampled[i];
    const to = sampled[i + 1];
    const mid = {
      latitude: (from.latitude + to.latitude) / 2,
      longitude: (from.longitude + to.longitude) / 2,
    };
    const lengthMetres = haversineMetres(
      from.latitude,
      from.longitude,
      to.latitude,
      to.longitude
    );

    const sensor = await pedestrian.nearestSensor(mid.latitude, mid.longitude);
    const covered = sensor.distanceMetres <= metrics.COVERAGE_RADIUS_METRES;

    let crowdScore = null;
    let street = null;
    let hasLiveData = false;

    if (covered) {
      const latest = await pedestrian.latestCount(sensor.sensorId, sensor.source);
      pedestrianSource = mergeSource(
        pedestrianSource,
        mergeSource(sensor.source, latest.source)
      );
      crowdScore = countToCrowdScore(latest.count);
      hasLiveData = typeof crowdScore === "number";
      if (hasLiveData) {
        street = sensorStreet(sensor.name);
        counts.push(latest.count);
        if (latest.observedAt) {
          if (!oldestObservedAt || latest.observedAt < oldestObservedAt) {
            oldestObservedAt = latest.observedAt;
          }
        }
        if (!seenSensors.has(sensor.sensorId)) {
          seenSensors.add(sensor.sensorId);
          sensorsUsed.push({
            sensorId: sensor.sensorId,
            name: sensor.name,
            distanceMetres: sensor.distanceMetres,
          });
        }
        if (crowdScore >= CONGESTION_POINT_SCORE) {
          congestionPoints.push({
            name: sensor.name,
            latitude: mid.latitude,
            longitude: mid.longitude,
            crowdScore,
          });
        }
      }
    }

    const seg = {
      fromLatitude: from.latitude,
      fromLongitude: from.longitude,
      toLatitude: to.latitude,
      toLongitude: to.longitude,
      lengthMetres,
      street,
      hasLiveData,
      crowdScore,
    };
    if (hasLiveData && (!peakCovered || crowdScore > peakCovered.crowdScore)) {
      peakCovered = seg;
    }
    segments.push(seg);
  }

  // Historical peak score for the rating reason: the mean for the peak segment's
  // sensor, at the departure hour and day-of-week (US1.1.2's developer step).
  let historicalPeakScore = null;
  if (peakCovered && sensorsUsed.length) {
    const peakSensor =
      sensorsUsed.find((s) => sensorStreet(s.name) === peakCovered.street) ||
      sensorsUsed[0];
    const { mean } = await pedestrian.hourlyMean(
      peakSensor.sensorId,
      dayOfWeek,
      hour,
      "live"
    );
    historicalPeakScore = countToCrowdScore(mean);
  }

  return {
    pedestrianSource: pedestrianSource || "mock",
    candidateFields: {
      segments,
      sensorsUsed,
      congestionPoints,
      bypassedAreas: [],
      averageCountPerHour: counts.length
        ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length)
        : null,
      historicalPeakScore,
      dataUpdatedAt: oldestObservedAt || now.toISOString(),
    },
  };
}

// Sensor names look like "Bourke Street Mall (North)"; strip the trailing
// direction qualifier to get a street-ish label for the rating reason.
function sensorStreet(name) {
  if (!name) return null;
  return name.replace(/\s*\(.*\)\s*$/, "").trim() || null;
}

// Pick up to `max` points roughly evenly along the polyline.
function samplepoints(points, max) {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const out = [];
  for (let i = 0; i < max; i += 1) out.push(points[Math.round(i * step)]);
  return out;
}

function mergeSource(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (a === b) return a;
  return "partial";
}

// Route data provenance: geometry (Google) + scoring (pedestrian).
function resolveDataSource(googleSource, pedestrianSource) {
  if (googleSource === "mock") return "mock";
  if (pedestrianSource === "live") return "live";
  return "partial"; // live geometry, mock/absent scoring
}

module.exports = {
  recommend,
  assembleBase,
  finalizeRoutes,
  byCalmestThenFastest,
  REFUGE_LOOKUP_MINUTES,
  CONGESTION_POINT_SCORE,
};
