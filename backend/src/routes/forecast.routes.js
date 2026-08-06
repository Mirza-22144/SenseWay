"use strict";

const express = require("express");
const validateForecastQuery = require("../middleware/validateForecastQuery");
const { getForecast } = require("../controllers/forecast.controller");

const router = express.Router();

router.get("/forecast", validateForecastQuery, getForecast);

module.exports = router;
