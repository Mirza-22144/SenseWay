"use strict";

/**
 * Convert a raw pedestrian count (people per hour past a sensor) into the app's
 * 0-100 crowd score.
 *
 * WHY a fixed reference rather than something cleverer: this iteration's model
 * is deliberately simple and must be explainable to a tutor. We linearly scale
 * against a reference "very busy" hourly count and cap at 100. The reference is
 * a rough calibration, not a statistically derived threshold - stated as a
 * limitation in the README so nobody mistakes it for ground truth.
 */
const PEAK_REFERENCE_COUNT = 1800;

function countToCrowdScore(count) {
  if (typeof count !== "number" || !Number.isFinite(count) || count < 0) {
    return null;
  }
  const score = Math.round((count / PEAK_REFERENCE_COUNT) * 100);
  return Math.max(0, Math.min(100, score));
}

module.exports = { PEAK_REFERENCE_COUNT, countToCrowdScore };
