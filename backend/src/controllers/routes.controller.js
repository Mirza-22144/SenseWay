"use strict";

const routeService = require("../services/route.service");
const rerouteService = require("../services/reroute.service");

/**
 * Thin controllers: take the already-validated, cleaned request, call the
 * service, send JSON. No business logic here. Async errors propagate to the
 * central error handler automatically in Express 5.
 */

async function postRoutes(req, res) {
  const result = await routeService.recommend(req.validated);
  res.json(result);
}

async function postReroute(req, res) {
  const result = await rerouteService.evaluate(req.validated);
  res.json(result);
}

module.exports = { postRoutes, postReroute };
