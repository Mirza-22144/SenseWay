"use strict";

const { ApiError } = require("./errorHandler");
const { isFiniteNumber } = require("../utils/geo");
const {
  validateCoordinatePair,
  validateDepartureTime,
  validateCrowdThreshold,
} = require("./validationHelpers");

/**
 * Validate POST /api/routes. Collects ALL problems, then either throws a single
 * INVALID_REQUEST with the full list or attaches a clean, rebuilt object to
 * req.validated. Nothing the client sent beyond the known fields survives.
 */
function validateRouteRequest(req, res, next) {
  const details = [];
  const body = req.body;

  // A POST with no body leaves req.body undefined in Express 5 (not {}). Guard
  // so we return a clean 400 rather than throwing on property access.
  if (body === undefined || body === null || typeof body !== "object") {
    throw ApiError.invalid(["Request body is required and must be a JSON object."]);
  }

  const start = validateCoordinatePair(body.start, "start", details);
  const destination = validateCoordinatePair(
    body.destination,
    "destination",
    details
  );
  const departureTime = validateDepartureTime(
    body.departureTime,
    "departureTime",
    details
  );

  // preferences is optional; defaults avoidHighDensity=true, crowdThreshold=70.
  const prefsIn =
    body.preferences && typeof body.preferences === "object"
      ? body.preferences
      : {};

  let avoidHighDensity = true;
  if (prefsIn.avoidHighDensity !== undefined) {
    if (typeof prefsIn.avoidHighDensity !== "boolean") {
      details.push("preferences.avoidHighDensity must be a boolean.");
    } else {
      avoidHighDensity = prefsIn.avoidHighDensity;
    }
  }

  const crowdThreshold = validateCrowdThreshold(
    prefsIn.crowdThreshold,
    "preferences.crowdThreshold",
    details
  );

  if (details.length > 0) {
    throw ApiError.invalid(details);
  }

  req.validated = {
    start,
    destination,
    departureTime,
    preferences: {
      avoidHighDensity,
      crowdThreshold: isFiniteNumber(crowdThreshold) ? crowdThreshold : 70,
    },
  };
  next();
}

module.exports = validateRouteRequest;
