"use strict";

const refugeService = require("../services/refuge.service");

async function getNearby(req, res) {
  const { latitude, longitude, walkingMinutes } = req.validated;
  const result = await refugeService.findNearby(
    latitude,
    longitude,
    walkingMinutes
  );

  // result.source is internal bookkeeping only - not part of the public contract
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
