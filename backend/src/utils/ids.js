"use strict";

const crypto = require("crypto");

/**
 * Stable, deterministic identifiers derived from coordinates.
 *
 * WHY deterministic and not stored: the MVP is accountless by design, so the
 * backend has nowhere to remember "the user already dismissed this congestion
 * prompt" (US1.3 AC2). Instead we derive the id purely from the point's
 * location, so the SAME congestion point always yields the SAME id across
 * requests and across server restarts. The frontend remembers which ids the
 * user dismissed and simply ignores them. No server state, no personal data.
 *
 * We round to ~5 decimal places (~1 metre) before hashing so that tiny float
 * differences in the same physical location still collapse to one id.
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

function refugeId(name, latitude, longitude) {
  // Landmark rows are not unique (landmarks.js has no ON CONFLICT), so we key a
  // refuge on name + coordinates to give the frontend a stable handle even if
  // the underlying table has duplicate rows.
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
