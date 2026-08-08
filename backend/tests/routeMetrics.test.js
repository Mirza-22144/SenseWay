"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const metrics = require("../src/services/routeMetrics");
const routeService = require("../src/services/route.service");

// Helper to build a raw segment.
function seg(rating, length) {
  const scoreByRating = { Low: 20, Moderate: 50, High: 85 };
  if (rating === "Unknown") {
    return { hasLiveData: false, crowdScore: null, lengthMetres: length };
  }
  return { hasLiveData: true, crowdScore: scoreByRating[rating], lengthMetres: length };
}

test("distanceBuckets sums only High into highCrowd and 0 when there are none", () => {
  const withHigh = metrics.distanceBuckets([
    seg("High", 200),
    seg("Low", 100),
    seg("Moderate", 100),
  ]);
  assert.equal(withHigh.highCrowdDistanceMetres, 200);

  const noHigh = metrics.distanceBuckets([seg("Low", 100), seg("Moderate", 100)]);
  assert.equal(noHigh.highCrowdDistanceMetres, 0);
});

test("the four distance buckets sum to the route total", () => {
  const segments = [
    seg("Low", 360),
    seg("Moderate", 320),
    seg("High", 340),
    seg("Unknown", 300),
  ];
  const b = metrics.distanceBuckets(segments);
  const sum =
    b.highCrowdDistanceMetres +
    b.moderateCrowdDistanceMetres +
    b.lowCrowdDistanceMetres +
    b.noDataDistanceMetres;
  assert.equal(sum, 360 + 320 + 340 + 300);
  assert.equal(b.totalDistanceMetres, sum);
  assert.equal(b.noDataDistanceMetres, 300); // the uncovered segment
});

test("an uncovered segment rates Unknown (never scored)", () => {
  assert.equal(metrics.segmentRating(seg("Unknown", 100)), "Unknown");
  assert.equal(metrics.segmentRating(seg("High", 100)), "High");
});

test("sensorCoverage is full / partial / none", () => {
  assert.equal(metrics.sensorCoverageFor([seg("Low", 1), seg("High", 1)]), "full");
  assert.equal(metrics.sensorCoverageFor([seg("Low", 1), seg("Unknown", 1)]), "partial");
  assert.equal(
    metrics.sensorCoverageFor([seg("Unknown", 1), seg("Unknown", 1)]),
    "none"
  );
});

test("dataState is unavailable / stale / live in the right conditions", () => {
  const now = new Date("2026-08-06T09:00:00+10:00");
  const fresh = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const old = new Date(now.getTime() - 31 * 60 * 1000).toISOString();

  // No live data anywhere -> unavailable, regardless of timestamp.
  assert.equal(
    metrics.dataStateFor([seg("Unknown", 1), seg("Unknown", 1)], fresh, now),
    "unavailable"
  );
  // Has live data but older than 30 min -> stale.
  assert.equal(metrics.dataStateFor([seg("Low", 1)], old, now), "stale");
  // Has fresh live data -> live.
  assert.equal(metrics.dataStateFor([seg("Low", 1)], fresh, now), "live");
});

test("ratingReason gives a band-specific sentence with live data, and none without", () => {
  const low = metrics.buildRatingReason({ hasLiveData: true, sensoryRating: "Low" });
  assert.match(low, /Low sensory rating because it avoids the busiest pedestrian areas/);

  const moderate = metrics.buildRatingReason({ hasLiveData: true, sensoryRating: "Moderate" });
  assert.match(moderate, /Moderate sensory rating/);

  const high = metrics.buildRatingReason({ hasLiveData: true, sensoryRating: "High" });
  assert.match(high, /High sensory rating/);

  const noData = metrics.buildRatingReason({ hasLiveData: false, sensoryRating: null });
  assert.ok(noData.length > 0);
  assert.doesNotMatch(noData, /Low sensory rating|Moderate sensory rating|High sensory rating/);
});

test("quieterAlternative is null when the alternative exceeds the extra-minute cap", () => {
  const routes = [
    { routeId: "calm", crowdScore: 20, durationMinutes: 25, highCrowdDistanceMetres: 0, dataState: "live" },
    { routeId: "fast", crowdScore: 80, durationMinutes: 15, highCrowdDistanceMetres: 800, dataState: "live" },
  ];
  const fastest = routes[1];
  const recommended = routes[0];

  // calm is +10 over fastest; with a 2-minute cap nothing qualifies.
  assert.equal(
    metrics.pickQuieterAlternative(routes, { fastest, recommended, maxExtraMinutes: 2 }),
    null
  );
  // With a generous cap, calm qualifies.
  assert.equal(
    metrics.pickQuieterAlternative(routes, { fastest, recommended, maxExtraMinutes: 15 }),
    "calm"
  );
});

test("quieterAlternative is null when the recommended route has no live data", () => {
  const routes = [
    { routeId: "calm", crowdScore: null, durationMinutes: 18, highCrowdDistanceMetres: 0, dataState: "unavailable" },
    { routeId: "fast", crowdScore: 80, durationMinutes: 15, highCrowdDistanceMetres: 800, dataState: "live" },
  ];
  assert.equal(
    metrics.pickQuieterAlternative(routes, {
      fastest: routes[1],
      recommended: routes[0],
      maxExtraMinutes: 10,
    }),
    null
  );
});

test("routes are capped per sensory band (Low/Moderate/High), not just the overall calmest three", () => {
  const now = new Date();
  const mk = (id, score, dur) =>
    routeService.assembleBase(
      {
        routeId: id,
        summary: id,
        durationMinutes: dur,
        dataUpdatedAt: now.toISOString(),
        segments: [
          { fromLatitude: 0, fromLongitude: 0, toLatitude: 0, toLongitude: 0, lengthMetres: 100, street: "X", hasLiveData: true, crowdScore: score },
        ],
      },
      { threshold: 70, now }
    );

  // Four Low, two Moderate, one High - more than fits within the per-band
  // quotas (3/1/1), so some within each band must be dropped, but the High
  // route (previously silently excluded by a flat "top 3 calmest" cap) must
  // now survive - a user should always be able to compare a fast-but-crowded
  // option against the calmer ones.
  const candidates = [
    mk("low1", 10, 15),
    mk("low2", 20, 16),
    mk("low3", 25, 17),
    mk("low4", 28, 18),
    mk("mod1", 35, 19),
    mk("mod2", 50, 20),
    mk("high1", 90, 12),
  ];
  const finalized = routeService.finalizeRoutes(candidates, {
    maxLowRoutes: metrics.MAX_LOW_ROUTES,
    maxModerateRoutes: metrics.MAX_MODERATE_ROUTES,
    maxHighRoutes: metrics.MAX_HIGH_ROUTES,
    maxExtraMinutes: metrics.ALTERNATIVE_MAX_EXTRA_MINUTES,
  });

  assert.equal(finalized.routes.length, 5); // 3 Low + 1 Moderate + 1 High
  const ids = finalized.routes.map((r) => r.routeId);
  assert.ok(ids.includes("low1") && ids.includes("low2") && ids.includes("low3"));
  assert.ok(!ids.includes("low4"), "4th Low route should be dropped (quota is 3)");
  assert.ok(ids.includes("mod1"), "calmest Moderate should be kept");
  assert.ok(!ids.includes("mod2"), "2nd Moderate should be dropped (quota is 1)");
  assert.ok(ids.includes("high1"), "High route must now be visible, not silently dropped");
  assert.equal(finalized.recommendedRouteId, "low1"); // calmest overall
});
