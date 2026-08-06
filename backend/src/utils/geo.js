"use strict";

/**
 * Geospatial helpers and the constants that define "where this app is allowed
 * to operate".
 */

// AC1 of the refuge story is a *walking time*, not a raw distance. We convert
// with a single named constant so the whole codebase agrees on how fast Freddy
// walks. ~80 m/min ≈ 4.8 km/h, a comfortable urban walking pace.
const WALKING_SPEED_METRES_PER_MINUTE = 80;

// Global sanity bounds.
const LAT_MIN = -90;
const LAT_MAX = 90;
const LON_MIN = -180;
const LON_MAX = 180;

// Greater Melbourne bounding box.
// WHY: coordinates are the only lever a caller has that costs us real money -
// every /api/routes call can become a paid Google Routes request. Restricting
// to greater Melbourne stops someone running up the bill by requesting routes
// in, say, London, and matches the fact that our pedestrian/landmark data only
// covers Melbourne anyway.
const MELBOURNE_BOUNDS = Object.freeze({
  latMin: -38.6,
  latMax: -37.4,
  lonMin: 144.4,
  lonMax: 145.6,
});

function isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function withinGlobalRange(lat, lon) {
  return (
    isFiniteNumber(lat) &&
    isFiniteNumber(lon) &&
    lat >= LAT_MIN &&
    lat <= LAT_MAX &&
    lon >= LON_MIN &&
    lon <= LON_MAX
  );
}

function withinMelbourne(lat, lon) {
  return (
    isFiniteNumber(lat) &&
    isFiniteNumber(lon) &&
    lat >= MELBOURNE_BOUNDS.latMin &&
    lat <= MELBOURNE_BOUNDS.latMax &&
    lon >= MELBOURNE_BOUNDS.lonMin &&
    lon <= MELBOURNE_BOUNDS.lonMax
  );
}

const EARTH_RADIUS_METRES = 6371000;

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance in metres between two lat/lon points. This is the same
 * Haversine maths the pipeline's refugeFinder.js does in SQL; we reproduce it
 * in JS for scoring points that never touch the database (mock data, Google
 * geometry).
 */
function haversineMetres(lat1, lon1, lat2, lon2) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METRES * c;
}

function walkingMinutesForMetres(metres) {
  return Math.round(metres / WALKING_SPEED_METRES_PER_MINUTE);
}

function metresForWalkingMinutes(minutes) {
  return Math.round(minutes * WALKING_SPEED_METRES_PER_MINUTE);
}

module.exports = {
  WALKING_SPEED_METRES_PER_MINUTE,
  MELBOURNE_BOUNDS,
  LAT_MIN,
  LAT_MAX,
  LON_MIN,
  LON_MAX,
  isFiniteNumber,
  withinGlobalRange,
  withinMelbourne,
  haversineMetres,
  walkingMinutesForMetres,
  metresForWalkingMinutes,
};
