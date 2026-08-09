"use strict";

/**
 * Central error handling. Every failure - validation, malformed JSON, unknown
 * route, upstream outage, or an unexpected crash - leaves through here as the
 * one JSON error envelope the frontend can rely on:
 *
 *   { "error": { "code": "...", "message": "...", "details": [ ... ] } }
 */

class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// convenience constructors for the codes in the API contract
ApiError.invalid = (details) =>
  new ApiError(400, "INVALID_REQUEST", "The request failed validation.", details);
ApiError.notFound = (message = "Resource not found.") =>
  new ApiError(404, "NOT_FOUND", message);
ApiError.upstream = (message = "An upstream service was unavailable.") =>
  new ApiError(502, "UPSTREAM_UNAVAILABLE", message);

// four-argument signature marks this as Express's error handler; Express 5
// forwards async-handler errors here automatically
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // body-parser failures -> our envelope, not a raw parser message
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json(
      envelope("MALFORMED_JSON", "Request body is not valid JSON.")
    );
  }
  if (err && err.type === "entity.too.large") {
    return res.status(413).json(
      envelope(
        "PAYLOAD_TOO_LARGE",
        "Request body is too large; the limit is 10kb."
      )
    );
  }

  if (err instanceof ApiError) {
    return res
      .status(err.status)
      .json(envelope(err.code, err.message, err.details));
  }

  // unexpected failure - log the real error, but never leak internals in the response
  console.error("[error] unhandled:", err);
  return res
    .status(500)
    .json(envelope("INTERNAL_ERROR", "An unexpected error occurred."));
}

function envelope(code, message, details = []) {
  return { error: { code, message, details } };
}

module.exports = { ApiError, errorHandler, envelope };
