"use strict";

const { ApiError } = require("./errorHandler");
const { isFiniteNumber } = require("../utils/geo");
const {
  validateCoordinatePair,
  validateDepartureTime,
  validateCrowdThreshold,
} = require("./validationHelpers");

// validates POST /api/routes; collects all problems into one 400, or
// attaches a clean rebuilt object to req.validated
function validateRouteRequest(req, res, next) {
  const details = [];
  const body = req.body;

  // Express 5 leaves req.body undefined (not {}) for a bodyless POST
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

  // preferences optional: defaults avoidHighDensity=true, crowdThreshold=70
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
