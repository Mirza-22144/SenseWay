"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const scoring = require("../src/services/scoring.service");

test("scoring returns Low/Moderate/High at the right band boundaries", () => {
  assert.equal(scoring.ratingForScore(0), "Low");
  assert.equal(scoring.ratingForScore(30), "Low"); // 30 is Low
  assert.equal(scoring.ratingForScore(31), "Moderate"); // 31 is Moderate
  assert.equal(scoring.ratingForScore(70), "Moderate"); // 70 is Moderate
  assert.equal(scoring.ratingForScore(71), "High"); // 71 is High
  assert.equal(scoring.ratingForScore(100), "High");
});

test("scoring returns Unknown for missing or out-of-range scores", () => {
  assert.equal(scoring.ratingForScore(null), "Unknown");
  assert.equal(scoring.ratingForScore(undefined), "Unknown");
  assert.equal(scoring.ratingForScore(NaN), "Unknown");
  assert.equal(scoring.ratingForScore(-1), "Unknown");
  assert.equal(scoring.ratingForScore(101), "Unknown");
});

test("staleness horizon is 30 minutes: 31 min is stale, 29 min is not", () => {
  // AC 1.1.2. NOTE: staleness no longer blanks the rating to Unknown (that was
  // the old 60-minute behaviour). Staleness now only drives the route dataState;
  // the numeric rating stays visible with an "outdated" warning. So this asserts
  // isStale, not a rating change.
  const now = new Date("2026-08-06T09:00:00+10:00");

  const twentyNine = new Date(now.getTime() - 29 * 60 * 1000);
  const thirtyOne = new Date(now.getTime() - 31 * 60 * 1000);

  assert.equal(scoring.isStale(twentyNine, now), false, "29 min is fresh");
  assert.equal(scoring.isStale(thirtyOne, now), true, "31 min is stale");
});

test("missing/invalid timestamp counts as stale (cannot confirm freshness)", () => {
  const now = new Date();
  assert.equal(scoring.isStale(null, now), true);
  assert.equal(scoring.isStale("not-a-date", now), true);
});
