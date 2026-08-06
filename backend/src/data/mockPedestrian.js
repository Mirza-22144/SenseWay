"use strict";

/**
 * Mock pedestrian data, used whenever the database is unconfigured or
 * unreachable so the frontend can build against a working /api/forecast and
 * /api/routes today.
 *
 * The hourly curve is a realistic weekday CBD shape for a busy Swanston-Street-
 * style sensor: quiet overnight, a sharp commuter peak ~8am, a lunch bump, and
 * an evening peak ~5pm. Values are MEAN people-per-hour, the same quantity the
 * real PEDESTRIAN_HOUR_COUNT.Total_of_Direction column stores, so the count ->
 * score maths is identical on both paths.
 */

// Index = hour of day (0-23). Weekday means.
const WEEKDAY_HOURLY_MEAN = [
  60, 35, 25, 20, 30, 90, 250, 620, 1400, 1100, 800, 900, 1300, 1350, 1100,
  1050, 1200, 1650, 1500, 1000, 700, 520, 400, 180,
];

// Weekends: lower commuter peaks, flatter midday. A single multiplier keeps the
// mock honest and simple rather than pretending to a second measured curve.
const WEEKEND_MULTIPLIER = 0.7;

// A representative mock sensor returned when the DB can't supply a real nearest
// sensor. distanceMetres is filled in by the service from the caller's point.
const MOCK_SENSOR = {
  sensorId: "6",
  name: "Swanston St / Flinders St (mock)",
  latitude: -37.8172,
  longitude: 144.9668,
};

/**
 * Mock "historical rows" for a given day-of-week and hour: we return a mean and
 * a plausible sampleSize so the forecast service exercises the same code path
 * as real data. isWeekend selects the curve.
 */
function mockHourlyMean(dayOfWeek, hour) {
  const h = ((hour % 24) + 24) % 24;
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const base = WEEKDAY_HOURLY_MEAN[h];
  const mean = Math.round(base * (isWeekend ? WEEKEND_MULTIPLIER : 1));
  return { mean, sampleSize: isWeekend ? 8 : 20 };
}

function getMockSensor() {
  return { ...MOCK_SENSOR };
}

module.exports = {
  WEEKDAY_HOURLY_MEAN,
  WEEKEND_MULTIPLIER,
  mockHourlyMean,
  getMockSensor,
};
