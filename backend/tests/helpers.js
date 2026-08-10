"use strict";

// Tests boot the app directly (not via server.js), so .env must be loaded
// here explicitly - otherwise every credential-gated integration (Google,
// the DB, the pipeline) silently looks "unconfigured" during tests even
// though real credentials exist, which is not what a pre-deploy test run
// should validate.
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const app = require("../src/app");

/**
 * Start the app on port 0 so tests never collide with a running dev server (or
 * with each other). Returns the http.Server; call baseUrl(server) for its URL.
 */
function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function baseUrl(server) {
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

const MELB_START = { latitude: -37.8136, longitude: 144.9631 };
const MELB_DEST = { latitude: -37.8183, longitude: 144.9671 };

module.exports = { startServer, baseUrl, closeServer, MELB_START, MELB_DEST };
