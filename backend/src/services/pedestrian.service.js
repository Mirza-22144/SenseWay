"use strict";

const env = require("../config/env");
const repo = require("../repositories/pedestrian.repository");

// Pedestrian data access, DB-only. Unlike routes/refuges, a missing/failed
// lookup here is NOT an upstream outage - "no live data" is a normal, honest
// state, so every function degrades to null instead of throwing.

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

// historical mean for (sensor, day-of-week, hour) - sampleSize 0 is returned
// as-is; forecast.service.js turns that into "Unknown", not a fabricated number
async function hourlyMean(sensorId, dayOfWeek, hour) {
  if (!sensorId) return { mean: null, sampleSize: 0 };
  try {
    return await repo.getHourlyMean(sensorId, dayOfWeek, hour);
  } catch (err) {
    console.error("[pedestrian.service] hourlyMean DB error:", err.message);
    return { mean: null, sampleSize: 0 };
  }
}

// recent mean live count for a sensor (see repository's getRecentMeanCount
// for why a window mean, not a single reading)
async function recentMeanCount(sensorId) {
  if (!sensorId) return { count: null, observedAt: null };
  try {
    const recent = await repo.getRecentMeanCount(sensorId);
    return recent || { count: null, observedAt: null };
  } catch (err) {
    console.error("[pedestrian.service] recentMeanCount DB error:", err.message);
    return { count: null, observedAt: null };
  }
}

module.exports = { nearestSensor, hourlyMean, recentMeanCount };
