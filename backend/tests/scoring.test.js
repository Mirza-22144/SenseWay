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

test("data older than 60 minutes returns Unknown, not a stale rating", () => {
  const now = new Date("2026-08-06T09:00:00+10:00");

  const fresh = scoring.ratingForFreshScore(20, {
    dataUpdatedAt: "2026-08-06T08:30:00+10:00", // 30 min old
    now,
  });
  assert.equal(fresh, "Low");

  const stale = scoring.ratingForFreshScore(20, {
    dataUpdatedAt: "2026-08-06T07:00:00+10:00", // 2 hours old
    now,
  });
  assert.equal(stale, "Unknown");

  const noTimestamp = scoring.ratingForFreshScore(20, { now });
  // With no timestamp we cannot claim freshness, but we don't invent staleness
  // either - we grade the number we were given.
  assert.equal(noTimestamp, "Low");
});
