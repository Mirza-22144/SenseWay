"use strict";

const {
  isFiniteNumber,
  withinGlobalRange,
  withinMelbourne,
} = require("../utils/geo");

// stable detail string the frontend keys off to show its own wording (API-CONTRACT.md)
const OUT_OF_MELBOURNE_DETAIL = (fieldName) =>
  `${fieldName} is outside the Melbourne CBD service area. Please enter a valid Melbourne CBD location.`;

// Server-side validation - the frontend's own checks are bypassable via curl,
// so these are the real enforcement. Every helper pushes ALL problems it
// finds into `details` rather than stopping at the first one.

// validates { latitude, longitude }; returns a clean {latitude, longitude}
// object (nothing else survives) or null if unusable
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

  return { latitude, longitude };
}

// optional ISO-8601 departureTime -> Date, defaults to now when absent
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

// optional numeric crowdThreshold (0-100), defaults to 70
function validateCrowdThreshold(value, fieldName, details, fallback = 70) {
  if (value === undefined || value === null) return fallback;
  if (!isFiniteNumber(value) || value < 0 || value > 100) {
    details.push(`${fieldName} must be a number between 0 and 100.`);
    return null;
  }
  return value;
}

// required numeric query param within [min, max]
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
  validateCoordinatePair,
  validateDepartureTime,
  validateCrowdThreshold,
  validateNumberInRange,
};
