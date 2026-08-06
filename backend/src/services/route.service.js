"use strict";

const google = require("./google.service");
const pedestrian = require("./pedestrian.service");
const refuge = require("./refuge.service");
const scoring = require("./scoring.service");
const { countToCrowdScore } = require("../utils/crowd");
const { haversineMetres } = require("../utils/geo");

/**
 * Orchestrates one route recommendation (US1.1 / US1.2).
 *
 * The calmest-first ordering is the ENTIRE product, so it lives here, applied
 * identically to mock and live candidates. This service never talks to the DB
 * or Google directly - it composes the google/pedestrian/refuge services and
 * the pure scoring service.
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

  // 1. Candidate geometry (live Google or mock).
  const { candidates, source: googleSource } = await google.getCandidateRoutes(
    start,
    destination
  );

  // 2. Ensure every candidate has scored segments. Mock candidates already do;
  //    live candidates get scored here from pedestrian data.
  let pedestrianSource = null;
  for (const c of candidates) {
    if (!Array.isArray(c.segments) || c.segments.length === 0) {
      const enriched = await scoreLiveCandidate(c, now);
      pedestrianSource = mergeSource(pedestrianSource, enriched.pedestrianSource);
      c.segments = enriched.segments;
      c.sensorsUsed = enriched.sensorsUsed;
      c.congestionPoints = enriched.congestionPoints;
      c.averageCountPerHour = enriched.averageCountPerHour;
      c.dataUpdatedAt = enriched.dataUpdatedAt;
    } else {
      // Mock candidates are timestamped "now" so freshness checks pass.
      c.dataUpdatedAt = now.toISOString();
    }
  }

  // 3. Fastest duration across all candidates (for the explicit trade-off).
  const fastest = candidates.reduce((best, c) =>
    best == null || c.durationMinutes < best.durationMinutes ? c : best,
    null
  );
  const fastestDuration = fastest ? fastest.durationMinutes : null;

  // 4. Assemble the full route objects.
  const routes = candidates.map((c) =>
    assembleRoute(c, { threshold, fastestDuration, now })
  );

  // 5. Calmest-first ordering: crowdScore ascending, duration as tie-break.
  //    Routes with an Unknown/no score sort last (they can't be recommended
  //    over a route we can actually vouch for).
  routes.sort(byCalmestThenFastest);

  const recommended = routes[0] || null;

  // 6. noLowSensoryRouteAvailable (US1.2 AC2): true when EVERY route has at
  //    least one segment over the user's threshold. We still recommend the
  //    least-bad route, but say so plainly.
  const noLowSensoryRouteAvailable =
    routes.length > 0 &&
    routes.every((r) => r.segments.some((s) => s.exceedsThreshold));

  const notice = noLowSensoryRouteAvailable
    ? "Every available route crosses at least one area above your crowd threshold. " +
      "We've recommended the calmest of them, but none avoids high density entirely."
    : null;

  // 7. Refuge spaces near the start, so Freddy can see a bolt-hole before he
  //    sets off.
  const refugeResult = await refuge.findNearby(
    start.latitude,
    start.longitude,
    REFUGE_LOOKUP_MINUTES
  );

  const dataSource = resolveDataSource(googleSource, pedestrianSource);
  const dataUpdatedAt = now.toISOString();

  return {
    query: request,
    recommendedRouteId: recommended ? recommended.routeId : null,
    fastestRouteId: fastest ? fastest.routeId : null,
    noLowSensoryRouteAvailable,
    notice,
    routes,
    refugeSpaces: refugeResult.refuges,
    dataUpdatedAt,
    dataSource,
  };
}

/**
 * Turn a raw candidate (with scored segments) into the full API route object.
 * Exported so the reroute service can reuse the exact same shape.
 */
function assembleRoute(candidate, { threshold, fastestDuration, now }) {
  const segScores = candidate.segments.map((s) => s.crowdScore);
  const crowdScore = scoring.meanScore(segScores);
  const numericScores = segScores.filter(
    (n) => typeof n === "number" && Number.isFinite(n)
  );
  const peakSegmentScore = numericScores.length
    ? Math.max(...numericScores)
    : null;

  const dataUpdatedAt = candidate.dataUpdatedAt || now.toISOString();
  const sensoryRating = scoring.ratingForFreshScore(crowdScore, {
    dataUpdatedAt,
    now,
  });

  const segments = candidate.segments.map((s, i) => ({
    segmentId: `${candidate.routeId}-seg-${i + 1}`,
    fromLatitude: s.fromLatitude,
    fromLongitude: s.fromLongitude,
    toLatitude: s.toLatitude,
    toLongitude: s.toLongitude,
    crowdScore: s.crowdScore,
    sensoryRating: scoring.ratingForFreshScore(s.crowdScore, {
      dataUpdatedAt,
      now,
    }),
    // exceedsThreshold is per-segment vs the user's own threshold (US1.2).
    exceedsThreshold:
      typeof s.crowdScore === "number" && s.crowdScore > threshold,
  }));

  const minutesSlowerThanFastest =
    candidate.durationMinutes != null && fastestDuration != null
      ? candidate.durationMinutes - fastestDuration
      : null;

  // "high" when we have a fresh, known rating; "low" when the rating is Unknown
  // (stale or missing data). Reflects trust in the number, not mock-vs-live.
  const confidence = sensoryRating === scoring.RATING_UNKNOWN ? "low" : "high";

  // bypassedAreas are only the high-density areas actually above the user's
  // threshold - filtered so a high threshold doesn't claim to "bypass" a place
  // the user was happy to walk through.
  const bypassedAreas = (candidate.bypassedAreas || []).filter(
    (a) => typeof a.crowdScore === "number" && a.crowdScore > threshold
  );

  return {
    routeId: candidate.routeId,
    summary: candidate.summary,
    durationMinutes: candidate.durationMinutes,
    distanceMetres: candidate.distanceMetres,
    minutesSlowerThanFastest,
    polyline: candidate.polyline,
    crowdScore,
    sensoryRating,
    confidence,
    dataUpdatedAt,
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

// Calmest first (lower crowdScore wins); a null score sorts last; ties broken by
// shorter duration.
function byCalmestThenFastest(a, b) {
  const sa = a.crowdScore == null ? Infinity : a.crowdScore;
  const sb = b.crowdScore == null ? Infinity : b.crowdScore;
  if (sa !== sb) return sa - sb;
  return (a.durationMinutes || Infinity) - (b.durationMinutes || Infinity);
}

/**
 * Score a live Google candidate segment-by-segment from pedestrian data.
 * Only runs on the live path (mock candidates arrive pre-scored). Not covered
 * by the mock test suite - noted in the README.
 */
async function scoreLiveCandidate(candidate, now) {
  const points = Array.isArray(candidate.points) ? candidate.points : [];
  const segments = [];
  const sensorsUsed = [];
  const seenSensors = new Set();
  const congestionPoints = [];
  const counts = [];
  let oldestObservedAt = null;
  let pedestrianSource = null;

  const sampled = samplepoints(points, 6);
  for (let i = 0; i < sampled.length - 1; i += 1) {
    const from = sampled[i];
    const to = sampled[i + 1];
    const mid = {
      latitude: (from.latitude + to.latitude) / 2,
      longitude: (from.longitude + to.longitude) / 2,
    };

    const sensor = await pedestrian.nearestSensor(mid.latitude, mid.longitude);
    const latest = await pedestrian.latestCount(sensor.sensorId, sensor.source);
    pedestrianSource = mergeSource(
      pedestrianSource,
      mergeSource(sensor.source, latest.source)
    );

    const crowdScore = countToCrowdScore(latest.count);
    if (typeof latest.count === "number") counts.push(latest.count);
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

    if (typeof crowdScore === "number" && crowdScore >= CONGESTION_POINT_SCORE) {
      congestionPoints.push({
        name: sensor.name,
        latitude: mid.latitude,
        longitude: mid.longitude,
        crowdScore,
      });
    }

    segments.push({
      fromLatitude: from.latitude,
      fromLongitude: from.longitude,
      toLatitude: to.latitude,
      toLongitude: to.longitude,
      crowdScore,
    });
  }

  return {
    segments,
    sensorsUsed,
    congestionPoints,
    averageCountPerHour: counts.length
      ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length)
      : null,
    dataUpdatedAt: oldestObservedAt || now.toISOString(),
    pedestrianSource: pedestrianSource || "mock",
  };
}

// Pick up to `max` points roughly evenly along the polyline.
function samplepoints(points, max) {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const out = [];
  for (let i = 0; i < max; i += 1) {
    out.push(points[Math.round(i * step)]);
  }
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
  // Google is live from here on.
  if (pedestrianSource === "live") return "live";
  if (pedestrianSource == null) return "partial";
  if (pedestrianSource === "mock") return "partial";
  return pedestrianSource; // "partial"
}

module.exports = {
  recommend,
  assembleRoute,
  byCalmestThenFastest,
  REFUGE_LOOKUP_MINUTES,
  CONGESTION_POINT_SCORE,
};
