"use strict";

const FIFTEEN_MIN_MS = 15 * 60 * 1000;

/**
 * Round a Date down to the previous 15-minute boundary, so forecast intervals
 * always start on :00 / :15 / :30 / :45 and line up cleanly with a UI slider.
 */
function floorToQuarterHour(date) {
  const ms = date.getTime();
  return new Date(ms - (ms % FIFTEEN_MIN_MS));
}

/**
 * Produce `count` Date objects spaced 15 minutes apart, starting at `start`.
 */
function quarterHourSteps(start, count) {
  const base = floorToQuarterHour(start).getTime();
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push(new Date(base + i * FIFTEEN_MIN_MS));
  }
  return out;
}

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

module.exports = {
  FIFTEEN_MIN_MS,
  floorToQuarterHour,
  quarterHourSteps,
  isValidDate,
};
