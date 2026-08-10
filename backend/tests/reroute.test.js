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

function postReroute(body) {
  return fetch(`${url}/api/routes/reroute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("reroute returns rerouteRecommended false when there is no congestion ahead", async () => {
  // Standing on the destination means every congestion point is behind us.
  const res = await postReroute({
    currentLocation: MELB_DEST,
    destination: MELB_DEST,
    activeRouteId: "route-2",
    preferences: { crowdThreshold: 70 },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.rerouteRecommended, false);
  assert.ok(typeof body.reason === "string" && body.reason.length > 0);
});

test("the same request produces the same reroute decision every time (idempotent)", async () => {
  // Whether a real congestion point above the threshold exists right now is a
  // live-data question we can't control here; what must always hold is that
  // identical input produces an identical, stable decision.
  const payload = {
    currentLocation: MELB_START,
    destination: MELB_DEST,
    activeRouteId: "route-1",
    preferences: { crowdThreshold: 70 },
  };
  const a = await (await postReroute(payload)).json();
  const b = await (await postReroute(payload)).json();

  assert.equal(a.rerouteRecommended, b.rerouteRecommended);
  if (a.rerouteRecommended) {
    assert.ok(a.congestionPointId);
    // Deterministic id derived purely from coordinates -> stable across requests.
    assert.equal(a.congestionPointId, b.congestionPointId);
    // alternativeRoute can legitimately be null - e.g. Google offered no other
    // route to go around the congestion. Only check its shape when present.
    if (a.alternativeRoute) {
      assert.ok(a.alternativeRoute.routeId);
    }
  } else {
    assert.equal(a.congestionPointId, undefined);
  }
});
