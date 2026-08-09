"use strict";

/**
 * Convert a raw pedestrian count (people per HOUR past a sensor) into the
 * app's 0-100 crowd score.
 *
 * WHY a fixed reference rather than something cleverer: this iteration's model
 * is deliberately simple and must be explainable to a tutor. We linearly scale
 * against a reference "very busy" hourly count and cap at 100. The reference is
 * a rough calibration, not a statistically derived threshold - stated as a
 * limitation in the README so nobody mistakes it for ground truth.
 *
 * IMPORTANT - this expects an HOURLY-scale count. PEDESTRIAN_HOUR_COUNT rows
 * are already hourly, so forecast.service.js can pass them straight through.
 * PEDESTRIAN_MINUTE_COUNT rows are NOT - real data shows minute readings
 * average ~14.5 (max ~960) against an hourly average of ~394 (max ~11,000).
 * Feeding a raw minute count in here directly (as route.service.js used to)
 * compares a per-minute magnitude against an hourly reference and it can
 * almost never clear the Moderate threshold - see
 * minuteCountToHourlyRate() below, which callers scoring live per-minute
 * readings must use first.
 */
const PEAK_REFERENCE_COUNT = 1800;

function countToCrowdScore(count) {
  if (typeof count !== "number" || !Number.isFinite(count) || count < 0) {
    return null;
  }
  const score = Math.round((count / PEAK_REFERENCE_COUNT) * 100);
  return Math.max(0, Math.min(100, score));
}

// Normalise a per-minute pedestrian rate (from PEDESTRIAN_MINUTE_COUNT - a
// single row's count, or the recent-window mean returned by
// pedestrian.repository.js's getRecentMeanCount) to the same hourly scale
// countToCrowdScore expects, by extrapolating it to a steady hourly rate -
// the standard way to compare a short-window rate against an hourly
// reference. A standard unit conversion, not a fabricated number: it says
// "at this rate, sustained for an hour", which is exactly what a live/
// current reading means.
function minuteCountToHourlyRate(minuteCount) {
  if (typeof minuteCount !== "number" || !Number.isFinite(minuteCount)) {
    return null;
  }
  return minuteCount * 60;
}

module.exports = { PEAK_REFERENCE_COUNT, countToCrowdScore, minuteCountToHourlyRate };
