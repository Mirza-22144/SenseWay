"use strict";

const crypto = require("crypto");

/**
 * Deterministic ids derived from coordinates - no server-side storage, so the
 * same point always hashes to the same id across requests/restarts. Rounded
 * to ~5 decimal places (~1m) first so tiny float differences still collapse
 * to one id.
 */

function roundCoord(n) {
  return Number(n).toFixed(5);
}

function pointHash(prefix, latitude, longitude) {
  const key = `${roundCoord(latitude)},${roundCoord(longitude)}`;
  const digest = crypto
    .createHash("sha1")
    .update(key)
    .digest("hex")
    .slice(0, 12);
  return `${prefix}-${digest}`;
}

function congestionPointId(latitude, longitude) {
  return pointHash("cp", latitude, longitude);
}

// keyed on name + coords, not row id - LANDMARK rows aren't guaranteed unique
function refugeId(name, latitude, longitude) {
  const key = `${String(name).trim().toLowerCase()}|${roundCoord(
    latitude
  )},${roundCoord(longitude)}`;
  const digest = crypto
    .createHash("sha1")
    .update(key)
    .digest("hex")
    .slice(0, 12);
  return `refuge-${digest}`;
}

module.exports = { congestionPointId, refugeId, pointHash };
