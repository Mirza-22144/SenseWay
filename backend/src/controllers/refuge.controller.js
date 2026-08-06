"use strict";

const refugeService = require("../services/refuge.service");

async function getNearby(req, res) {
  const { latitude, longitude, walkingMinutes } = req.validated;
  const result = await refugeService.findNearby(
    latitude,
    longitude,
    walkingMinutes
  );

  // The service's internal `source` field is for our own dataSource bookkeeping;
  // the public refuge contract does not expose it.
  res.json({
    origin: result.origin,
    walkingMinutes: result.walkingMinutes,
    radiusMetres: result.radiusMetres,
    openingHoursKnown: result.openingHoursKnown,
    count: result.count,
    refuges: result.refuges,
  });
}

module.exports = { getNearby };
