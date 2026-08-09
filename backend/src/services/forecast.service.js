"use strict";

const pedestrian = require("./pedestrian.service");
const scoring = require("./scoring.service");
const { countToCrowdScore } = require("../utils/crowd");
const { quarterHourSteps, melbourneParts } = require("../utils/time");

// Predictive hourly crowding forecast: the mean of historical hourly counts
// for this sensor/day-of-week/hour, from PEDESTRIAN_HOUR_COUNT. No ML, no
// trend fitting - deliberately simple, documented as such in the README.

// below this many historical rows, the mean isn't trusted as "confident"
const MIN_CONFIDENT_SAMPLE = 10;

async function forecast(request) {
  const { latitude, longitude, departureTime, hours } = request;

  const sensor = await pedestrian.nearestSensor(latitude, longitude);

  const intervalCount = hours * 4; // 15-minute steps
  const steps = quarterHourSteps(departureTime, intervalCount);

  // historical mean for each interval's day-of-week + hour
  const raw = [];
  for (const start of steps) {
    // Melbourne wall clock, not the server's (Cloud Run runs in UTC)
    const { dayOfWeek: dow, hour } = melbourneParts(start);
    const { mean, sampleSize } = sensor
      ? await pedestrian.hourlyMean(sensor.sensorId, dow, hour)
      : { mean: null, sampleSize: 0 };
    raw.push({ start, mean, sampleSize });
  }

  const intervals = raw.map((r) => buildInterval(r.start, r.mean, r.sampleSize));

  // baseline is the requested departure slot (first interval)
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
    sampleSize: intervals.length ? intervals[0].sampleSize : 0, // for the requested slot
    requestedDepartureTime: departureTime.toISOString(),
    intervals: intervals.map(stripInternal),
    calmestInterval,
  };
}

// pure, exported so "zero rows -> Unknown, low confidence" is unit-testable directly
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

// drops the raw per-interval sampleSize - top-level sampleSize covers it
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
};
