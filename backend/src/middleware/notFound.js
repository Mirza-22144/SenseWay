"use strict";

const { ApiError } = require("./errorHandler");

// catch-all 404, mounted after all routes (app.get("*") throws in Express 5) -
// forwards an ApiError so the client gets JSON, never Express's default HTML 404
function notFound(req, res, next) {
  next(ApiError.notFound(`No endpoint matches ${req.method} ${req.path}.`));
}

module.exports = notFound;
