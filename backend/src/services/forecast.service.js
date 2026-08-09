"use strict";

const pedestrian = require("./pedestrian.service");
const scoring = require("./scoring.service");
const { countToCrowdScore } = require("../utils/crowd");
const { quarterHourSteps, melbourneParts } = require("../utils/time");

/**
 * Predictive hourly crowding forecast (US2.2).
 *
 * The model this iteration is deliberately the simplest defensible thing: the
 * MEAN of historical hourly counts for this sensor, on this day-of-week, at this
 * hour, from PEDESTRIAN_HOUR_COUNT. No ML, no trend fitting. It is documented as
 * such (and its limitations) in the README so nobody oversells it.
 *
 * Trap 5 matters here: that table is only a thin recent slice, so many
 * (sensor, dow, hour) buckets have few or zero rows. When a bucket is thin we
 * return "Unknown" with low confidence rather than a fabricated number.
 */

// Below this many historical rows we do not trust the mean enough to call it
// confident.
const MIN_CONFIDENT_SAMPLE = 10;

async function forecast(request) {
  const { latitude, longitude, departureTime, hours } = request;

  // No DB configured, or nothing nearby - honest "no sensor" rather than
  // inventing one; every interval below degrades to Unknown/low-confidence.
  const sensor = await pedestrian.nearestSensor(latitude, longitude);

  const intervalCount = hours * 4; // 15-minute steps
  const steps = quarterHourSteps(departureTime, intervalCount);

  // Fetch the historical mean for each interval's day-of-week + hour.
  const raw = [];
  for (const start of steps) {
    // Bucket by MELBOURNE wall clock, not the server's zone. The pedestrian data
    // is recorded in Melbourne local time and Cloud Run runs in UTC, so using
    // start.getDay()/getHours() here would be silently wrong in production.
    const { dayOfWeek: dow, hour } = melbourneParts(start);
    const { mean, sampleSize } = sensor
      ? await pedestrian.hourlyMean(sensor.sensorId, dow, hour)
      : { mean: null, sampleSize: 0 };
    raw.push({ start, mean, sampleSize });
  }

  const intervals = raw.map((r) => buildInterval(r.start, r.mean, r.sampleSize));

  // Baseline for the percentage comparison is the requested departure slot,
  // which is the first interval. "leaving 15 min earlier reduces density by X%"
  // is exactly (thisScore - baseline) / baseline.
  const baseline = intervals.length ? intervals[0].crowdScore : null;
  for (const iv of intervals) {
    iv.percentChangeVsRequested = percentChange(baseline, iv.crowdScore);
  }

  const calmestInterval = pickCalmest(intervals);

  return {
    location: { latitude, longitude },
    nearestSensor: sensor
      ? { sensorId: sensor.sensorId, name: sensor.name, distanceMetres: sensor.distanceMetres }
      : null,
    method: "historical mean for this sensor, day-of-week and hour",
    // Sample size of the requested (first) interval, so the caller can judge how
    // much to trust the headline number.
    sampleSize: intervals.length ? intervals[0].sampleSize : 0,
    requestedDepartureTime: departureTime.toISOString(),
    intervals: intervals.map(stripInternal),
    calmestInterval,
  };
}

/**
 * Build one interval from a historical mean and its sample size.
 * PURE and exported so the "zero rows -> Unknown, low confidence, not a number"
 * behaviour can be unit-tested directly.
 */
function buildInterval(start, mean, sampleSize) {
  const thin = !sampleSize || sampleSize === 0 || mean == null;
  const crowdScore = thin ? null : countToCrowdScore(mean);
  const sensoryRating =
    crowdScore == null
      ? scoring.RATING_UNKNOWN
      : scoring.ratingForScore(crowdScore);
  const confidence =
    !thin && sampleSize >= MIN_CONFIDENT_SAMPLE ? "high" : "low";

  return {
    startTime: start.toISOString(),
    crowdScore,
    sensoryRating,
    confidence,
    sampleSize: sampleSize || 0,
    percentChangeVsRequested: null,
  };
}

function percentChange(baseline, value) {
  if (
    typeof baseline !== "number" ||
    baseline === 0 ||
    typeof value !== "number"
  ) {
    return null;
  }
  return Math.round(((value - baseline) / baseline) * 100);
}

function pickCalmest(intervals) {
  const scored = intervals.filter((iv) => typeof iv.crowdScore === "number");
  if (scored.length === 0) return null;
  const calmest = scored.reduce((best, iv) =>
    iv.crowdScore < best.crowdScore ? iv : best
  );
  return {
    startTime: calmest.startTime,
    crowdScore: calmest.crowdScore,
    sensoryRating: calmest.sensoryRating,
  };
}

// sampleSize is used internally for confidence/baseline; the public interval
// keeps confidence but not the raw sampleSize (top-level sampleSize covers it).
function stripInternal(iv) {
  return {
    startTime: iv.startTime,
    crowdScore: iv.crowdScore,
    sensoryRating: iv.sensoryRating,
    percentChangeVsRequested: iv.percentChangeVsRequested,
    confidence: iv.confidence,
  };
}

module.exports = {
  forecast,
  buildInterval,
  MIN_CONFIDENT_SAMPLE,
};
