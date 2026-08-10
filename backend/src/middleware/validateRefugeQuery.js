"use strict";

const { ApiError } = require("./errorHandler");
const {
  validateCoordinatePair,
  validateNumberInRange,
} = require("./validationHelpers");

// validates GET /api/refuges/nearby - walkingMinutes optional, default 5, capped at 30
function validateRefugeQuery(req, res, next) {
  const details = [];
  const q = req.query || {};

  // query params arrive as strings - coerce before range-checking
  const coords = validateCoordinatePair(
    {
      latitude: q.latitude !== undefined ? Number(q.latitude) : undefined,
      longitude: q.longitude !== undefined ? Number(q.longitude) : undefined,
    },
    "location",
    details
  );

  const walkingMinutes = validateNumberInRange(
    q.walkingMinutes,
    "walkingMinutes",
    details,
    { min: 1, max: 30, fallback: 5 }
  );

  if (details.length > 0) {
    throw ApiError.invalid(details);
  }

  req.validated = {
    latitude: coords.latitude,
    longitude: coords.longitude,
    walkingMinutes,
  };
  next();
}

module.exports = validateRefugeQuery;
