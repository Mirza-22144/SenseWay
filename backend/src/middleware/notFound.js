"use strict";

const { ApiError } = require("./errorHandler");

/**
 * Catch-all 404.
 *
 * WHY app.use and not app.get("*"): in Express 5 a "*" path string throws at
 * startup (the path-to-regexp upgrade rejects it). Mounting a plain middleware
 * after all routes is the correct Express 5 way to catch unmatched requests.
 *
 * We forward an ApiError so it goes through the same envelope as every other
 * failure - the client always gets JSON, never Express's default HTML 404.
 */
function notFound(req, res, next) {
  next(ApiError.notFound(`No endpoint matches ${req.method} ${req.path}.`));
}

module.exports = notFound;
