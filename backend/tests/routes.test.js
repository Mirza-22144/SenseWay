"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const {
  startServer,
  baseUrl,
  closeServer,
  MELB_START,
  MELB_DEST,
} = require("./helpers");

let server;
let url;

before(async () => {
  server = await startServer();
  url = baseUrl(server);
});
after(async () => closeServer(server));

function postRoutes(body, headers) {
  return fetch(`${url}/api/routes`, {
    method: "POST",
    headers: headers || { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const validBody = {
  start: MELB_START,
  destination: MELB_DEST,
  departureTime: "2026-08-06T08:15:00+10:00",
  preferences: { avoidHighDensity: true, crowdThreshold: 70 },
};

test("valid POST /api/routes returns routes, recommended/fastest ids and refugeSpaces", async () => {
  const res = await postRoutes(validBody);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.routes) && body.routes.length >= 1);
  assert.ok(body.recommendedRouteId);
  assert.ok(body.fastestRouteId);
  assert.ok(Array.isArray(body.refugeSpaces));
  // No mock fallback anywhere in this pipeline anymore - geometry is always
  // live; "partial" is the honest answer when no segment had sensor coverage.
  assert.ok(["live", "partial"].includes(body.dataSource));
});

test("the calmest route is ranked first (AC 1.1.1 calmest-first ordering)", async () => {
  const res = await postRoutes(validBody);
  const body = await res.json();

  const first = body.routes[0];
  assert.equal(first.routeId, body.recommendedRouteId, "first is the recommended");

  // Calmest-first: every subsequent route has an equal-or-higher crowd score.
  // (A null score - Unknown - sorts last, per byCalmestThenFastest.)
  for (let i = 1; i < body.routes.length; i += 1) {
    const prevScore = first.crowdScore == null ? Infinity : first.crowdScore;
    const curScore = body.routes[i].crowdScore == null ? Infinity : body.routes[i].crowdScore;
    assert.ok(curScore >= prevScore, "routes are ordered calmest-first");
  }
});

test("minutesSlowerThanFastest is arithmetically correct", async () => {
  const res = await postRoutes(validBody);
  const body = await res.json();
  const fastest = body.routes.find((r) => r.routeId === body.fastestRouteId);
  const recommended = body.routes.find(
    (r) => r.routeId === body.recommendedRouteId
  );
  assert.equal(fastest.minutesSlowerThanFastest, 0);
  assert.equal(
    recommended.minutesSlowerThanFastest,
    recommended.durationMinutes - fastest.durationMinutes
  );
});

test("noLowSensoryRouteAvailable, when set, always carries a non-empty notice and a recommendation", async () => {
  // With live data we can't force real-world crowd levels to exceed a given
  // threshold, so this asserts the CONTRACT (the flag implies a notice and a
  // recommendation) rather than forcing the flag itself - a threshold of 0
  // makes it as likely as live data allows without fabricating anything.
  const res = await postRoutes({
    ...validBody,
    preferences: { avoidHighDensity: true, crowdThreshold: 0 },
  });
  const body = await res.json();
  assert.ok(body.recommendedRouteId, "still recommends a route regardless");
  if (body.noLowSensoryRouteAvailable) {
    assert.ok(
      typeof body.notice === "string" && body.notice.length > 0,
      "notice is a non-empty string when the flag is set"
    );
  } else {
    assert.equal(body.notice, null);
  }
});

test("segments carry exceedsThreshold correctly against a custom crowdThreshold", async () => {
  const res = await postRoutes({
    ...validBody,
    preferences: { avoidHighDensity: true, crowdThreshold: 50 },
  });
  const body = await res.json();

  // Data-independent invariant: a covered segment's exceedsThreshold must
  // agree exactly with its own crowdScore vs the threshold used; an
  // uncovered segment must never exceed (it has no score to compare).
  for (const r of body.routes) {
    for (const s of r.segments) {
      if (!s.hasLiveData || s.crowdScore == null) {
        assert.equal(s.exceedsThreshold, false, "uncovered segment never exceeds");
      } else {
        assert.equal(s.exceedsThreshold, s.crowdScore > 50);
      }
    }
  }
});

test("missing destination returns 400 with details listing the problem", async () => {
  const { destination, ...noDest } = validBody;
  const res = await postRoutes(noDest);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, "INVALID_REQUEST");
  assert.ok(Array.isArray(body.error.details) && body.error.details.length > 0);
  assert.ok(body.error.details.some((d) => /destination/i.test(d)));
});

test("latitude 999 returns 400", async () => {
  const res = await postRoutes({
    ...validBody,
    start: { latitude: 999, longitude: 144.9631 },
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, "INVALID_REQUEST");
});

test("out-of-Melbourne coordinate returns a distinguishable 400 (AC 1.1.1)", async () => {
  const res = await postRoutes({
    ...validBody,
    start: { latitude: 51.5074, longitude: -0.1278 }, // London
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, "INVALID_REQUEST");
  // Distinguishable from other validation failures: carries the exact AC wording
  // the frontend shows ("Please enter a valid Melbourne CBD location").
  assert.ok(
    body.error.details.some((d) => /valid Melbourne CBD location/i.test(d)),
    "out-of-area detail is distinguishable"
  );
});

test("malformed JSON returns 400 MALFORMED_JSON", async () => {
  const res = await fetch(`${url}/api/routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{ this is not valid json",
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, "MALFORMED_JSON");
});

test("POST with no body returns 400, not a crash", async () => {
  const res = await fetch(`${url}/api/routes`, { method: "POST" });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, "INVALID_REQUEST");
});

// --- Acceptance-criteria fields (US1.1 / US1.2) -----------------------------

test("each route carries dataState and sensorCoverage (AC 1.1.2 / 1.2.1)", async () => {
  const body = await (await postRoutes(validBody)).json();
  for (const r of body.routes) {
    assert.ok(["live", "stale", "unavailable"].includes(r.dataState));
    assert.ok(["full", "partial", "none"].includes(r.sensorCoverage));
    // dataState "unavailable" <=> no segment has live data <=> sensorCoverage "none".
    const anyLive = r.segments.some((s) => s.hasLiveData);
    assert.equal(r.dataState === "unavailable", !anyLive);
    assert.equal(r.sensorCoverage === "none", !anyLive);
  }
});

test("ratingReason matches the route's own sensory band, for every route (AC 1.1.2)", async () => {
  const body = await (await postRoutes(validBody)).json();
  for (const r of body.routes) {
    assert.ok(typeof r.ratingReason === "string" && r.ratingReason.length > 0);
    if (r.dataState === "unavailable") {
      assert.match(r.ratingReason, /unavailable/i);
    } else {
      assert.match(r.ratingReason, new RegExp(`${r.sensoryRating} sensory rating`));
    }
  }
});

test("an uncovered segment is Unknown, hasLiveData false, and carries no score (AC 1.2.1)", async () => {
  const body = await (await postRoutes(validBody)).json();
  const uncovered = body.routes.flatMap((r) => r.segments).filter((s) => s.hasLiveData === false);
  // Whether any segment is uncovered right now depends on live sensor
  // coverage - assert the invariant conditionally rather than requiring one.
  for (const s of uncovered) {
    assert.equal(s.sensoryRating, "Unknown");
    assert.equal(s.crowdScore, null);
  }
});

test("the four distance buckets sum to the route total (AC 1.2.2)", async () => {
  const body = await (await postRoutes(validBody)).json();
  for (const r of body.routes) {
    const sum =
      r.highCrowdDistanceMetres +
      r.moderateCrowdDistanceMetres +
      r.lowCrowdDistanceMetres +
      r.noDataDistanceMetres;
    assert.equal(sum, r.distanceMetres, `${r.routeId} buckets sum to total`);
  }
});

test("highCrowdDistanceMetres counts only High segments, for every route (AC 1.2.2)", async () => {
  const body = await (await postRoutes(validBody)).json();
  for (const r of body.routes) {
    const highLen = r.segments
      .filter((s) => s.sensoryRating === "High")
      .reduce((a, s) => a + s.lengthMetres, 0);
    assert.equal(r.highCrowdDistanceMetres, Math.round(highLen));
  }
});

test("response exposes the quieter-alternative budget, and the alternative (if any) has a real trade-off (AC 1.2.3)", async () => {
  const body = await (await postRoutes(validBody)).json();
  assert.equal(body.alternativeMaxExtraMinutes, 10);
  // Whether a quieter alternative exists right now depends on live conditions
  // (it's null when the fastest route has no high-crowd exposure to avoid) -
  // assert its shape conditionally rather than requiring one to exist.
  if (body.quieterAlternativeRouteId) {
    const alt = body.routes.find((r) => r.routeId === body.quieterAlternativeRouteId);
    assert.ok(alt.highCrowdDistanceSavedMetres > 0, "alt avoids some high-crowd distance");
    assert.ok(typeof alt.minutesSlowerThanRecommended === "number");
  }
});

test("routes never exceed the Low+Moderate+High band cap (AC 1.1.1)", async () => {
  const body = await (await postRoutes(validBody)).json();
  assert.ok(body.routes.length <= 5); // 3 Low + 1 Moderate + 1 High, at most
});

test("no routes available is 200 with an explicit flag, not a 500 (AC 1.1.1 / 2.1.3)", async () => {
  // Start == destination: there is no route to walk.
  const res = await postRoutes({
    ...validBody,
    start: { latitude: -37.8136, longitude: 144.9631 },
    destination: { latitude: -37.8136, longitude: 144.9631 },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.noRoutesAvailable, true);
  assert.deepEqual(body.routes, []);
  assert.equal(body.recommendedRouteId, null);
  assert.equal(body.quieterAlternativeRouteId, null);
});
