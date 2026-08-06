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

// Convenience constructors for the codes in the contract.
ApiError.invalid = (details) =>
  new ApiError(400, "INVALID_REQUEST", "The request failed validation.", details);
ApiError.notFound = (message = "Resource not found.") =>
  new ApiError(404, "NOT_FOUND", message);
ApiError.upstream = (message = "An upstream service was unavailable.") =>
  new ApiError(502, "UPSTREAM_UNAVAILABLE", message);

// The four-argument signature is what marks this as Express's error handler.
// Express 5 forwards errors thrown in async handlers here automatically, so
// controllers don't need try/catch just to avoid crashing.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Body-parser failures surface with a `type`. We translate them into our
  // envelope so a raw parser message never reaches the browser.
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

  // Anything else is a genuine bug or an unexpected failure. Log the REAL error
  // server-side for us, but return a generic message: a stack trace or a
  // Postgres error string in the response would leak internals to an attacker.
  console.error("[error] unhandled:", err);
  return res
    .status(500)
    .json(envelope("INTERNAL_ERROR", "An unexpected error occurred."));
}

function envelope(code, message, details = []) {
  return { error: { code, message, details } };
}

module.exports = { ApiError, errorHandler, envelope };
