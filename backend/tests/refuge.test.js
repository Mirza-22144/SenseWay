"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer, baseUrl, closeServer } = require("./helpers");

let server;
let url;

before(async () => {
  server = await startServer();
  url = baseUrl(server);
});
after(async () => closeServer(server));

test("refuges endpoint converts 5 walking minutes to 400 metres", async () => {
  const res = await fetch(
    `${url}/api/refuges/nearby?latitude=-37.8136&longitude=144.9631&walkingMinutes=5`
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.walkingMinutes, 5);
  assert.equal(body.radiusMetres, 400); // 5 min * 80 m/min
});

test("refuges response has openNow null and openingHoursKnown false", async () => {
  const res = await fetch(
    `${url}/api/refuges/nearby?latitude=-37.8136&longitude=144.9631&walkingMinutes=10`
  );
  const body = await res.json();
  assert.equal(body.openingHoursKnown, false);
  assert.ok(body.count >= 1, "expected at least one mock refuge in range");
  for (const r of body.refuges) {
    assert.equal(r.openNow, null);
    assert.equal(r.seatingAvailable, null);
    assert.equal(r.noiseLevel, null);
    assert.ok("indoorOutdoor" in r);
  }
});

test("refuges endpoint rejects missing coordinates with 400", async () => {
  const res = await fetch(`${url}/api/refuges/nearby?walkingMinutes=5`);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, "INVALID_REQUEST");
});
