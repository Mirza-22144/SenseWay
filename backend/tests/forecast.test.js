"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer, baseUrl, closeServer } = require("./helpers");
const forecastService = require("../src/services/forecast.service");

let server;
let url;

before(async () => {
  server = await startServer();
  url = baseUrl(server);
});
after(async () => closeServer(server));

test("forecast returns 15-minute intervals and identifies a calmest interval", async () => {
  const res = await fetch(
    `${url}/api/forecast?latitude=-37.8136&longitude=144.9631&departureTime=2026-08-06T08:15:00%2B10:00&hours=2`
  );
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.intervals.length, 8, "2 hours * 4 = 8 fifteen-minute steps");
  // Consecutive intervals are 15 minutes apart.
  const t0 = new Date(body.intervals[0].startTime).getTime();
  const t1 = new Date(body.intervals[1].startTime).getTime();
  assert.equal(t1 - t0, 15 * 60 * 1000);

  assert.ok(body.calmestInterval, "calmestInterval present");
  assert.ok("percentChangeVsRequested" in body.intervals[0]);
  assert.equal(body.intervals[0].percentChangeVsRequested, 0, "baseline is 0%");
});

test("forecast with zero historical rows returns Unknown and low confidence, not a number", async () => {
  // Unit-test the pure interval builder directly: a bucket with 0 rows must not
  // fabricate a score.
  const zero = forecastService.buildInterval(new Date(), null, 0);
  assert.equal(zero.crowdScore, null);
  assert.equal(zero.sensoryRating, "Unknown");
  assert.equal(zero.confidence, "low");

  // Even a non-null mean with a 0 sample size is thin data -> still Unknown.
  const thin = forecastService.buildInterval(new Date(), 500, 0);
  assert.equal(thin.crowdScore, null);
  assert.equal(thin.sensoryRating, "Unknown");
  assert.equal(thin.confidence, "low");
});
