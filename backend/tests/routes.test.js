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
  assert.ok(Array.isArray(body.routes) && body.routes.length >= 2);
  assert.ok(body.recommendedRouteId);
  assert.ok(body.fastestRouteId);
  assert.ok(Array.isArray(body.refugeSpaces));
  assert.equal(body.dataSource, "mock");
});

test("the calmest route is ranked first AND is not the fastest route", async () => {
  const res = await postRoutes(validBody);
  const body = await res.json();

  const first = body.routes[0];
  assert.equal(first.routeId, body.recommendedRouteId, "first is the recommended");

  // Calmest-first: every subsequent route has an equal-or-higher crowd score.
  for (let i = 1; i < body.routes.length; i += 1) {
    assert.ok(
      body.routes[i].crowdScore >= first.crowdScore,
      "routes are ordered calmest-first"
    );
  }

  // The recommended (calmest) route must NOT be the fastest one - that's the
  // whole point of the product.
  assert.notEqual(body.recommendedRouteId, body.fastestRouteId);
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

test("when every route exceeds the threshold, the no-low flag and notice are set", async () => {
  // A very low threshold means every route has a segment over it.
  const res = await postRoutes({
    ...validBody,
    preferences: { avoidHighDensity: true, crowdThreshold: 10 },
  });
  const body = await res.json();
  assert.equal(body.noLowSensoryRouteAvailable, true);
  assert.ok(
    typeof body.notice === "string" && body.notice.length > 0,
    "notice is a non-empty string"
  );
  // We still recommend the least-bad route.
  assert.ok(body.recommendedRouteId);
});

test("segments carry exceedsThreshold correctly against a custom crowdThreshold", async () => {
  const res = await postRoutes({
    ...validBody,
    preferences: { avoidHighDensity: true, crowdThreshold: 50 },
  });
  const body = await res.json();

  // route-2 (Bourke Street Mall) is the busy one; all its segments score > 50.
  const busy = body.routes.find((r) => r.routeId === "route-2");
  assert.ok(busy.segments.every((s) => s.exceedsThreshold === true));

  // route-1 (Little Collins) is calm; none of its segments exceed 50.
  const calm = body.routes.find((r) => r.routeId === "route-1");
  assert.ok(calm.segments.every((s) => s.exceedsThreshold === false));
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

test("coordinates in London return 400 (outside greater Melbourne)", async () => {
  const res = await postRoutes({
    ...validBody,
    start: { latitude: 51.5074, longitude: -0.1278 },
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, "INVALID_REQUEST");
  assert.ok(body.error.details.some((d) => /Melbourne/i.test(d)));
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
