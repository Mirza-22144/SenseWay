"use strict";

const env = require("../config/env");
const repo = require("../repositories/pedestrian.repository");
const { haversineMetres } = require("../utils/geo");
const { getMockSensor, mockHourlyMean } = require("../data/mockPedestrian");

/**
 * Pedestrian data access with a real DB path and a mock fallback behind the
 * SAME function signatures. When the team supplies DB credentials this file
 * does not change - only env.hasDatabase flips to true.
 *
 * `source` on every return tells the orchestrating service whether the number
 * came from "live" data or "mock", so the API can honestly report dataSource.
 */

async function nearestSensor(latitude, longitude) {
  if (env.hasDatabase) {
    try {
      const sensor = await repo.findNearestSensor(latitude, longitude);
      if (sensor) return { ...sensor, source: "live" };
    } catch (err) {
      // DB unreachable/misconfigured -> warn once and degrade to mock, rather
      // than 500-ing. The frontend still gets a usable response.
      console.warn(
        "[pedestrian.service] nearestSensor DB error, using mock:",
        err.message
      );
    }
  }

  const m = getMockSensor();
  return {
    sensorId: m.sensorId,
    name: m.name,
    latitude: m.latitude,
    longitude: m.longitude,
    distanceMetres: Math.round(
      haversineMetres(latitude, longitude, m.latitude, m.longitude)
    ),
    source: "mock",
  };
}

/**
 * Historical mean for (sensor, day-of-week, hour).
 *
 * IMPORTANT (trap 5): when the real DB is configured we return exactly what it
 * gives us, INCLUDING sampleSize 0. We do NOT paper over thin data with mock
 * numbers - the forecast service turns a 0 sample into an honest "Unknown".
 * Mock is used only when there is no DB at all, or the sensor itself is a mock.
 */
async function hourlyMean(sensorId, dayOfWeek, hour, sensorSource) {
  if (env.hasDatabase && sensorSource === "live") {
    try {
      const { mean, sampleSize } = await repo.getHourlyMean(
        sensorId,
        dayOfWeek,
        hour
      );
      return { mean, sampleSize, source: "live" };
    } catch (err) {
      console.warn(
        "[pedestrian.service] hourlyMean DB error, using mock:",
        err.message
      );
    }
  }

  const { mean, sampleSize } = mockHourlyMean(dayOfWeek, hour);
  return { mean, sampleSize, source: "mock" };
}

/**
 * Latest live count for a sensor (for scoring live routes and freshness).
 * Returns { count, observedAt, source } or a mock reading.
 */
async function latestCount(sensorId, sensorSource) {
  if (env.hasDatabase && sensorSource === "live") {
    try {
      const latest = await repo.getLatestCount(sensorId);
      if (latest) return { ...latest, source: "live" };
    } catch (err) {
      console.warn(
        "[pedestrian.service] latestCount DB error, using mock:",
        err.message
      );
    }
  }
  // Mock live reading: timestamped now so freshness checks treat it as current.
  return { count: null, observedAt: new Date().toISOString(), source: "mock" };
}

module.exports = { nearestSensor, hourlyMean, latestCount };
