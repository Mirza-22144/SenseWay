"use strict";

const express = require("express");
const validateRefugeQuery = require("../middleware/validateRefugeQuery");
const { getNearby } = require("../controllers/refuge.controller");

const router = express.Router();

router.get("/refuges/nearby", validateRefugeQuery, getNearby);

module.exports = router;
