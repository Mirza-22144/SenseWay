"use strict";

// linear scale against a fixed "very busy" hourly reference, capped at 100 -
// a rough calibration, not a statistical threshold (see README)
const PEAK_REFERENCE_COUNT = 1800;

// count MUST be hourly-scale. PEDESTRIAN_HOUR_COUNT rows already are;
// PEDESTRIAN_MINUTE_COUNT rows are NOT - run those through
// minuteCountToHourlyRate() first or the score comes out artificially low.
function countToCrowdScore(count) {
  if (typeof count !== "number" || !Number.isFinite(count) || count < 0) {
    return null;
  }
  const score = Math.round((count / PEAK_REFERENCE_COUNT) * 100);
  return Math.max(0, Math.min(100, score));
}

// extrapolates a per-minute rate to an hourly rate ("at this rate, sustained
// for an hour") - feed the result into countToCrowdScore()
function minuteCountToHourlyRate(minuteCount) {
  if (typeof minuteCount !== "number" || !Number.isFinite(minuteCount)) {
    return null;
  }
  return minuteCount * 60;
}

module.exports = { countToCrowdScore, minuteCountToHourlyRate };
