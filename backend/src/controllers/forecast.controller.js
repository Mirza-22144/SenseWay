"use strict";

const forecastService = require("../services/forecast.service");

async function getForecast(req, res) {
  const result = await forecastService.forecast(req.validated);
  res.json(result);
}

module.exports = { getForecast };
