"use strict";

const google = require("./google.service");
const routeService = require("./route.service");
const metrics = require("./routeMetrics");
const { haversineMetres } = require("../utils/geo");
const { congestionPointId } = require("../utils/ids");

// Dynamic peak-hour rerouting: given the user's current location, destination
// and active route, decides whether there's a congestion point ahead worth
// warning about and offers a calmer alternative if so.
//
// congestionPointId is derived purely from coordinates (not stored - the MVP
// is accountless) so dismissals stay stable: same point -> same id always,
// and the frontend filters out ids the user already dismissed.

async function evaluate(request) {
  const { currentLocation, destination, activeRouteId, preferences } = request;
  const threshold = preferences.crowdThreshold;

  const { candidates } = await google.getCandidateRoutes(
    currentLocation,
    destination
  );
  // candidates arrive unscored - score them first or congestionPoints stays empty
  await routeService.scoreCandidates(candidates, new Date());

  const activeRoute =
    candidates.find((c) => c.routeId === activeRouteId) || candidates[0] || null;

  // anything closer to the destination than this is "ahead"; farther = already passed
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
    .filter((x) => x.cpToDest < userToDest) // only points still in front of the user
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

// calmest candidate that isn't the one the user is already on
function buildAlternative(candidates, activeRouteId, threshold) {
  const now = new Date();
  const assembled = candidates
    .filter((c) => c.routeId !== activeRouteId)
    .map((c) => {
      if (!c.dataUpdatedAt) c.dataUpdatedAt = now.toISOString();
      return routeService.assembleBase(c, { threshold, now });
    });

  const finalized = routeService.finalizeRoutes(assembled, {
    maxLowRoutes: metrics.MAX_LOW_ROUTES,
    maxModerateRoutes: metrics.MAX_MODERATE_ROUTES,
    maxHighRoutes: metrics.MAX_HIGH_ROUTES,
    maxExtraMinutes: metrics.ALTERNATIVE_MAX_EXTRA_MINUTES,
  });
  return finalized.routes[0] || null;
}

module.exports = { evaluate };
