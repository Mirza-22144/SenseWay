"use strict";

const google = require("./google.service");
const pedestrian = require("./pedestrian.service");
const refuge = require("./refuge.service");
const scoring = require("./scoring.service");
const metrics = require("./routeMetrics");
const { countToCrowdScore, minuteCountToHourlyRate } = require("../utils/crowd");
const { haversineMetres } = require("../utils/geo");

// Orchestrates one route recommendation: composes the google/pedestrian/
// refuge services + the pure scoring/routeMetrics helpers. Every per-route
// field the frontend needs to pick its message (dataState, sensorCoverage,
// distance buckets, ratingReason, quieter alternative) is computed here.

// walking minutes of refuges to attach near the start point
const REFUGE_LOOKUP_MINUTES = 5;

// score at/above this is a "congestion point", independent of the user's own threshold
const CONGESTION_POINT_SCORE = 71;

async function recommend(request) {
  const { start, destination, preferences } = request;
  const threshold = preferences.crowdThreshold;
  const now = new Date();

  // 1. candidate geometry from Google - empty means no routes exist
  const { candidates, source: googleSource } = await google.getCandidateRoutes(
    start,
    destination
  );

  // 2. score every candidate's segments against live pedestrian data
  const pedestrianSource = await scoreCandidates(candidates, now);

  // 3. assemble full route objects (no cross-route fields yet)
  const assembled = candidates.map((c) => assembleBase(c, { threshold, now }));

  // 4. rank calmest-first, pick a Low/Moderate/High spread, add cross-route fields
  const finalized = finalizeRoutes(assembled, {
    maxLowRoutes: metrics.MAX_LOW_ROUTES,
    maxModerateRoutes: metrics.MAX_MODERATE_ROUTES,
    maxHighRoutes: metrics.MAX_HIGH_ROUTES,
    maxExtraMinutes: metrics.ALTERNATIVE_MAX_EXTRA_MINUTES,
  });
  const routes = finalized.routes;

  // 5. no routes is a normal 200 outcome, not a 500 - frontend picks the message
  const noRoutesAvailable = routes.length === 0;

  // 6. true when EVERY route has at least one covered segment over the user's threshold
  const noLowSensoryRouteAvailable =
    routes.length > 0 &&
    routes.every((r) => r.segments.some((s) => s.exceedsThreshold));

  const notice = noLowSensoryRouteAvailable
    ? "Every available route crosses at least one area above your crowd threshold. " +
      "We've recommended the calmest of them, but none avoids high density entirely."
    : null;

  // 7. refuge suggestions near the start - a pipeline outage here must not
  // fail the route response, so degrade to no suggestions instead
  let refugeSpaces = [];
  try {
    const refugeResult = await refuge.findNearby(
      start.latitude,
      start.longitude,
      REFUGE_LOOKUP_MINUTES
    );
    refugeSpaces = refugeResult.refuges;
  } catch (err) {
    console.warn("[route.service] refuge lookup failed, omitting refugeSpaces:", err.message);
  }

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
    refugeSpaces,
    dataUpdatedAt: now.toISOString(),
    dataSource: resolveDataSource(googleSource, pedestrianSource),
  };
}

// turns a scored candidate into a full route object (minus cross-route
// fields, added in finalizeRoutes) - exported for the reroute service too
function assembleBase(candidate, { threshold, now }) {
  const rawSegments = candidate.segments || [];
  const dataUpdatedAt = candidate.dataUpdatedAt || now.toISOString();

  // only covered segments feed the route score - never average in an unmeasured one
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
    // uncovered segments carry no crowd score - Unknown/neutral-grey
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
    sensoryRating,
  });

  // "high" only for a fresh, known rating; dataState is the richer signal
  const confidence =
    crowdScore != null && dataState === "live" ? "high" : "low";

  // only the high-density areas actually above the user's threshold
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
    // four-state distance breakdown for the map legend / route summary
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
    steps: candidate.steps || [], // turn-by-turn ("Get Navigation"), from the Google Routes API
    alerts: [],
  };
}

// ranks calmest-first, then picks a genuine Low/Moderate/High spread (not
// just the overall calmest handful), computes cross-route trade-off fields
// and the quieter alternative. Shared by recommend() and reroute.
function finalizeRoutes(routeObjs, { maxLowRoutes, maxModerateRoutes, maxHighRoutes, maxExtraMinutes }) {
  const sorted = routeObjs.slice().sort(byCalmestThenFastest);

  if (sorted.length === 0) {
    return {
      routes: [],
      recommendedRouteId: null,
      fastestRouteId: null,
      quieterAlternativeRouteId: null,
    };
  }

  const byBand = { Low: [], Moderate: [], High: [] };
  for (const r of sorted) {
    if (byBand[r.sensoryRating]) byBand[r.sensoryRating].push(r);
  }

  let routes = [
    ...byBand.Low.slice(0, maxLowRoutes),
    ...byBand.Moderate.slice(0, maxModerateRoutes),
    ...byBand.High.slice(0, maxHighRoutes),
  ].sort(byCalmestThenFastest);

  // nothing had a scored band (e.g. all Unknown) - fall back to a plain calmest-first cap
  if (routes.length === 0) {
    routes = sorted.slice(0, maxLowRoutes + maxModerateRoutes + maxHighRoutes);
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

// lower crowdScore wins, null sorts last, ties broken by shorter duration
function byCalmestThenFastest(a, b) {
  const sa = a.crowdScore == null ? Infinity : a.crowdScore;
  const sb = b.crowdScore == null ? Infinity : b.crowdScore;
  if (sa !== sb) return sa - sb;
  return (a.durationMinutes || Infinity) - (b.durationMinutes || Infinity);
}

// scores every candidate's segments against live pedestrian data, in place.
// Shared by recommend() and reroute so a candidate is scored identically once.
async function scoreCandidates(candidates, now) {
  // independent per candidate, so score them all at once - pg pool (max: 5,
  // see config/database.js) naturally caps real concurrency
  const enrichedCandidates = await Promise.all(
    candidates.map((c) => {
      if (!c.dataUpdatedAt) c.dataUpdatedAt = now.toISOString();
      return scoreLiveCandidate(c, now);
    })
  );

  let pedestrianSource = null;
  enrichedCandidates.forEach((enriched, i) => {
    pedestrianSource = mergeSource(pedestrianSource, enriched.pedestrianSource);
    Object.assign(candidates[i], enriched.candidateFields);
  });
  return pedestrianSource;
}

// scores a Google candidate segment-by-segment; a segment with no sensor
// within COVERAGE_RADIUS_METRES is left unscored, never guessed. Segments are
// independent, so scoreSegment() runs them all concurrently.
async function scoreLiveCandidate(candidate, now) {
  const points = Array.isArray(candidate.points) ? candidate.points : [];
  const sampled = samplepoints(points, 6);

  const pairs = [];
  for (let i = 0; i < sampled.length - 1; i += 1) {
    pairs.push([sampled[i], sampled[i + 1]]);
  }
  const scoredSegments = await Promise.all(pairs.map(([from, to]) => scoreSegment(from, to)));

  const segments = [];
  const sensorsUsed = [];
  const seenSensors = new Set();
  const congestionPoints = [];
  const counts = [];
  let oldestObservedAt = null;
  let pedestrianSource = null;

  for (const scored of scoredSegments) {
    segments.push(scored.segment);
    if (scored.hasLiveData) {
      pedestrianSource = "live";
      counts.push(scored.hourlyRate);
      if (scored.observedAt) {
        if (!oldestObservedAt || scored.observedAt < oldestObservedAt) {
          oldestObservedAt = scored.observedAt;
        }
      }
      if (!seenSensors.has(scored.sensor.sensorId)) {
        seenSensors.add(scored.sensor.sensorId);
        sensorsUsed.push({
          sensorId: scored.sensor.sensorId,
          name: scored.sensor.name,
          distanceMetres: scored.sensor.distanceMetres,
        });
      }
      if (scored.segment.crowdScore >= CONGESTION_POINT_SCORE) {
        congestionPoints.push({
          name: scored.sensor.name,
          latitude: scored.mid.latitude,
          longitude: scored.mid.longitude,
          crowdScore: scored.segment.crowdScore,
        });
      }
    }
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
      dataUpdatedAt: oldestObservedAt || now.toISOString(),
    },
  };
}

// nearest sensor, then (if covered) its recent reading - self-contained, no
// dependency on any other segment
async function scoreSegment(from, to) {
  const mid = {
    latitude: (from.latitude + to.latitude) / 2,
    longitude: (from.longitude + to.longitude) / 2,
  };
  const lengthMetres = haversineMetres(from.latitude, from.longitude, to.latitude, to.longitude);

  // no DB, or no sensor found - both mean "not covered", never invented
  const sensor = await pedestrian.nearestSensor(mid.latitude, mid.longitude);
  const covered = Boolean(sensor) && sensor.distanceMetres <= metrics.COVERAGE_RADIUS_METRES;

  let crowdScore = null;
  let hasLiveData = false;
  let hourlyRate = null;
  let observedAt = null;

  if (covered) {
    const latest = await pedestrian.recentMeanCount(sensor.sensorId);
    hourlyRate = minuteCountToHourlyRate(latest.count); // per-minute rate -> hourly scale
    crowdScore = countToCrowdScore(hourlyRate);
    hasLiveData = typeof crowdScore === "number";
    observedAt = latest.observedAt;
  }

  return {
    segment: {
      fromLatitude: from.latitude,
      fromLongitude: from.longitude,
      toLatitude: to.latitude,
      toLongitude: to.longitude,
      lengthMetres,
      hasLiveData,
      crowdScore,
    },
    hasLiveData,
    hourlyRate,
    observedAt,
    sensor,
    mid,
  };
}

// up to `max` points, roughly evenly spaced along the polyline
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

// route data provenance: geometry (Google) + scoring (pedestrian)
function resolveDataSource(googleSource, pedestrianSource) {
  if (googleSource === "mock") return "mock";
  if (pedestrianSource === "live") return "live";
  return "partial"; // live geometry, absent scoring
}

module.exports = {
  recommend,
  assembleBase,
  finalizeRoutes,
  scoreCandidates,
  byCalmestThenFastest,
};
