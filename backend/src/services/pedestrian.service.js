"use strict";

const env = require("../config/env");
const repo = require("../repositories/pedestrian.repository");

/**
 * Pedestrian data access, DB-only - no mock fallback.
 *
 * Unlike routes (Google) or refuges (the pipeline), a missing/failed sensor
 * lookup here is NOT treated as an upstream outage: "no live data for this
 * spot" is already a first-class, honest product state (AC 1.2.1's neutral
 * grey / "no live data" segments, AC 1.1.2's "Detailed sensory data
 * unavailable"), not an error. So every function degrades to null/no-data
 * instead of throwing, and the route service treats a null sensor exactly
 * like a real sensor that's simply too far away - never fabricated, never a
 * 502 for the whole route just because one segment lacks coverage.
 */

async function nearestSensor(latitude, longitude) {
  if (!env.hasDatabase) return null;
  try {
    const sensor = await repo.findNearestSensor(latitude, longitude);
    return sensor ? { ...sensor, source: "live" } : null;
  } catch (err) {
    console.error("[pedestrian.service] nearestSensor DB error:", err.message);
    return null;
  }
}

/**
 * Historical mean for (sensor, day-of-week, hour).
 *
 * IMPORTANT (trap 5): we return exactly what the DB gives us, INCLUDING
 * sampleSize 0 - the forecast service turns a 0 sample into an honest
 * "Unknown" rather than a fabricated number.
 */
async function hourlyMean(sensorId, dayOfWeek, hour) {
  if (!sensorId) return { mean: null, sampleSize: 0 };
  try {
    return await repo.getHourlyMean(sensorId, dayOfWeek, hour);
  } catch (err) {
    console.error("[pedestrian.service] hourlyMean DB error:", err.message);
    return { mean: null, sampleSize: 0 };
  }
}

/**
 * Latest live count for a sensor (for scoring live routes and freshness).
 * Returns { count, observedAt } - both null when there's nothing to report.
 */
async function latestCount(sensorId) {
  if (!sensorId) return { count: null, observedAt: null };
  try {
    const latest = await repo.getLatestCount(sensorId);
    return latest || { count: null, observedAt: null };
  } catch (err) {
    console.error("[pedestrian.service] latestCount DB error:", err.message);
    return { count: null, observedAt: null };
  }
}

module.exports = { nearestSensor, hourlyMean, latestCount };
