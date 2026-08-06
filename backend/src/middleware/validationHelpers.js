"use strict";

const {
  isFiniteNumber,
  withinGlobalRange,
  withinMelbourne,
} = require("../utils/geo");

// AC 1.1.1: an out-of-area location must be distinguishable from other
// validation failures so the frontend can show its exact wording, "Please enter
// a valid Melbourne CBD location", rather than a generic message. This is a
// stable, documented detail string the frontend keys off (see API-CONTRACT.md).
const OUT_OF_MELBOURNE_DETAIL = (fieldName) =>
  `${fieldName} is outside the Melbourne CBD service area. Please enter a valid Melbourne CBD location.`;

/**
 * Shared validation helpers.
 *
 * WHY we validate on the server even though React validates too: React's
 * validation is a convenience for the user, not a security control. Anyone can
 * bypass the frontend entirely and hit these endpoints with curl. The server is
 * the only place that can actually enforce these rules, so it must - especially
 * the Melbourne bounding box, which is what stops a caller running up our Google
 * bill with arbitrary worldwide coordinates.
 *
 * All helpers PUSH every problem they find into the shared `details` array
 * rather than returning on the first one, so the client gets the full list of
 * what's wrong in a single response.
 */

/**
 * Validate a { latitude, longitude } pair. Returns a CLEAN object containing
 * only those two known fields (nothing else the client sent survives), or null
 * if the pair is unusable.
 */
function validateCoordinatePair(value, fieldName, details) {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    details.push(`${fieldName} is required and must be an object with latitude and longitude.`);
    return null;
  }

  const { latitude, longitude } = value;
  let ok = true;

  if (!isFiniteNumber(latitude)) {
    details.push(`${fieldName}.latitude is required and must be a number.`);
    ok = false;
  }
  if (!isFiniteNumber(longitude)) {
    details.push(`${fieldName}.longitude is required and must be a number.`);
    ok = false;
  }
  if (!ok) return null;

  if (!withinGlobalRange(latitude, longitude)) {
    details.push(
      `${fieldName} must have latitude between -90 and 90 and longitude between -180 and 180.`
    );
    return null;
  }

  if (!withinMelbourne(latitude, longitude)) {
    details.push(OUT_OF_MELBOURNE_DETAIL(fieldName));
    return null;
  }

  // Rebuild a clean object - only the two fields we trust travel onward.
  return { latitude, longitude };
}

/**
 * Validate an optional ISO-8601 departureTime. Returns a Date. Defaults to now
 * when absent. Pushes a problem and returns null when present-but-unparseable.
 */
function validateDepartureTime(value, fieldName, details) {
  if (value === undefined || value === null) return new Date();
  if (typeof value !== "string") {
    details.push(`${fieldName} must be an ISO-8601 date-time string.`);
    return null;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    details.push(`${fieldName} must be a valid ISO-8601 date-time string.`);
    return null;
  }
  return d;
}

/**
 * Validate an optional numeric crowdThreshold (0-100). Defaults to 70.
 */
function validateCrowdThreshold(value, fieldName, details, fallback = 70) {
  if (value === undefined || value === null) return fallback;
  if (!isFiniteNumber(value) || value < 0 || value > 100) {
    details.push(`${fieldName} must be a number between 0 and 100.`);
    return null;
  }
  return value;
}

/**
 * Parse a required numeric query param within [min, max].
 */
function validateNumberInRange(value, fieldName, details, { min, max, fallback }) {
  if (value === undefined || value === null || value === "") {
    if (fallback !== undefined) return fallback;
    details.push(`${fieldName} is required.`);
    return null;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    details.push(`${fieldName} must be a number between ${min} and ${max}.`);
    return null;
  }
  return n;
}

module.exports = {
  OUT_OF_MELBOURNE_DETAIL,
  validateCoordinatePair,
  validateDepartureTime,
  validateCrowdThreshold,
  validateNumberInRange,
};
