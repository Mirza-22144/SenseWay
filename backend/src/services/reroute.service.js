"use strict";

const google = require("./google.service");
const routeService = require("./route.service");
const metrics = require("./routeMetrics");
const { haversineMetres } = require("../utils/geo");
const { congestionPointId } = require("../utils/ids");

/**
 * Dynamic peak-hour rerouting (US1.3).
 *
 * Given where the user is right now, their destination and their active route,
 * decide whether there's a congestion point AHEAD worth warning about and, if
 * so, offer a calmer alternative.
 *
 * Two acceptance criteria shape the logic:
 *  - AC2 (dismissals must stick): we cannot store dismissals because the MVP is
 *    accountless, so we return a STABLE congestionPointId derived purely from
 *    the point's coordinates. The frontend remembers which ids the user
 *    dismissed and filters them out. Same point -> same id, every time.
 *  - AC3 (no already-passed points): a congestion point is only "ahead" if it is
 *    closer to the destination than the user currently is. Points the user has
 *    already walked past are dropped.
 */

async function evaluate(request) {
  const { currentLocation, destination, activeRouteId, preferences } = request;
  const threshold = preferences.crowdThreshold;

  const { candidates } = await google.getCandidateRoutes(
    currentLocation,
    destination
  );

  const activeRoute =
    candidates.find((c) => c.routeId === activeRouteId) || candidates[0] || null;

  // Distance from the user to the destination now. Anything closer to the
  // destination than this is "ahead"; anything farther has been passed.
  const userToDest = haversineMetres(
    currentLocation.latitude,
    currentLocation.longitude,
    destination.latitude,
    destination.longitude
  );

  const pointsAhead = (activeRoute ? activeRoute.congestionPoints || [] : [])
    .filter((cp) => typeof cp.crowdScore === "number" && cp.crowdScore > threshold)
    .map((cp) => ({
      cp,
      cpToDest: haversineMetres(
        cp.latitude,
        cp.longitude,
        destination.latitude,
        destination.longitude
      ),
      metresAhead: Math.round(
        haversineMetres(
          currentLocation.latitude,
          currentLocation.longitude,
          cp.latitude,
          cp.longitude
        )
      ),
    }))
    // AC3: keep only points still in front of the user.
    .filter((x) => x.cpToDest < userToDest)
    .sort((a, b) => a.metresAhead - b.metresAhead);

  if (pointsAhead.length === 0) {
    return {
      rerouteRecommended: false,
      reason: "No congestion ahead above your threshold.",
    };
  }

  const nearest = pointsAhead[0];
  const cp = nearest.cp;

  const alternativeRoute = buildAlternative(candidates, activeRouteId, threshold);

  return {
    rerouteRecommended: true,
    congestionPointId: congestionPointId(cp.latitude, cp.longitude),
    congestionPoint: {
      name: cp.name,
      latitude: cp.latitude,
      longitude: cp.longitude,
      crowdScore: cp.crowdScore,
    },
    metresAhead: nearest.metresAhead,
    reason: `${cp.name} ahead is above your crowd threshold.`,
    alternativeRoute,
  };
}

// The calmest candidate that isn't the one the user is already on.
function buildAlternative(candidates, activeRouteId, threshold) {
  const now = new Date();
  const assembled = candidates
    .filter((c) => c.routeId !== activeRouteId)
    .map((c) => {
      if (!c.dataUpdatedAt) c.dataUpdatedAt = now.toISOString();
      return routeService.assembleBase(c, { threshold, now });
    });

  const finalized = routeService.finalizeRoutes(assembled, {
    maxRoutes: metrics.MAX_ROUTES,
    maxExtraMinutes: metrics.ALTERNATIVE_MAX_EXTRA_MINUTES,
  });
  return finalized.routes[0] || null;
}

module.exports = { evaluate };
