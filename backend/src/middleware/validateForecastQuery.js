"use strict";

const { ApiError } = require("./errorHandler");
const {
  validateCoordinatePair,
  validateDepartureTime,
  validateNumberInRange,
} = require("./validationHelpers");

// validates GET /api/forecast query params - departureTime defaults to now,
// hours defaults to 2 and is capped at 6
function validateForecastQuery(req, res, next) {
  const details = [];
  const q = req.query || {};

  const coords = validateCoordinatePair(
    {
      latitude: q.latitude !== undefined ? Number(q.latitude) : undefined,
      longitude: q.longitude !== undefined ? Number(q.longitude) : undefined,
    },
    "location",
    details
  );

  const departureTime = validateDepartureTime(
    q.departureTime,
    "departureTime",
    details
  );

  const hours = validateNumberInRange(q.hours, "hours", details, {
    min: 1,
    max: 6,
    fallback: 2,
  });

  if (details.length > 0) {
    throw ApiError.invalid(details);
  }

  req.validated = {
    latitude: coords.latitude,
    longitude: coords.longitude,
    departureTime,
    hours,
  };
  next();
}

module.exports = validateForecastQuery;
