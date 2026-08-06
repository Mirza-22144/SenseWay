"use strict";

const { ApiError } = require("./errorHandler");
const {
  validateCoordinatePair,
  validateNumberInRange,
} = require("./validationHelpers");

/**
 * Validate GET /api/refuges/nearby query params. walkingMinutes is optional and
 * defaults to 5; it is capped at 30 so a caller can't request an absurd radius.
 */
function validateRefugeQuery(req, res, next) {
  const details = [];
  const q = req.query || {};

  // Query params arrive as strings; coerce lat/lon before range-checking.
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
