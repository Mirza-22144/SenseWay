"use strict";

const { ApiError } = require("./errorHandler");
const { isFiniteNumber } = require("../utils/geo");
const {
  validateCoordinatePair,
  validateCrowdThreshold,
} = require("./validationHelpers");

// validates POST /api/routes/reroute - same approach as validateRouteRequest
function validateRerouteRequest(req, res, next) {
  const details = [];
  const body = req.body;

  if (body === undefined || body === null || typeof body !== "object") {
    throw ApiError.invalid(["Request body is required and must be a JSON object."]);
  }

  const currentLocation = validateCoordinatePair(
    body.currentLocation,
    "currentLocation",
    details
  );
  const destination = validateCoordinatePair(
    body.destination,
    "destination",
    details
  );

  let activeRouteId = null;
  if (typeof body.activeRouteId !== "string" || body.activeRouteId.trim() === "") {
    details.push("activeRouteId is required and must be a non-empty string.");
  } else {
    activeRouteId = body.activeRouteId.trim();
  }

  const prefsIn =
    body.preferences && typeof body.preferences === "object"
      ? body.preferences
      : {};
  const crowdThreshold = validateCrowdThreshold(
    prefsIn.crowdThreshold,
    "preferences.crowdThreshold",
    details
  );

  if (details.length > 0) {
    throw ApiError.invalid(details);
  }

  req.validated = {
    currentLocation,
    destination,
    activeRouteId,
    preferences: {
      crowdThreshold: isFiniteNumber(crowdThreshold) ? crowdThreshold : 70,
    },
  };
  next();
}

module.exports = validateRerouteRequest;
