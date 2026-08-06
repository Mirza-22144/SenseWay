"use strict";

const express = require("express");
const validateRouteRequest = require("../middleware/validateRouteRequest");
const validateRerouteRequest = require("../middleware/validateRerouteRequest");
const { postRoutes, postReroute } = require("../controllers/routes.controller");

const router = express.Router();

// Validation middleware runs before the controller; by the time the controller
// runs, req.validated holds a clean, known-fields-only object.
router.post("/routes", validateRouteRequest, postRoutes);
router.post("/routes/reroute", validateRerouteRequest, postReroute);

module.exports = router;
