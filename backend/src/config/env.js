"use strict";

/**
 * Single source of truth for environment configuration - every other module
 * reads the frozen `env` object here, never process.env directly.
 *
 * Missing Google/DB/pipeline credentials don't crash startup: /api/health
 * stays up, and only the specific endpoint that needs the missing credential
 * returns 502 UPSTREAM_UNAVAILABLE. A malformed value that IS present (e.g.
 * PORT not a number) still throws, since that's a real mistake.
 */

// values shipped in .env.example - treated as "not set" if left unedited
const PLACEHOLDERS = new Set([
  "",
  "our_password",
  "google_maps_api_key",
  "your_api_key",
  "changeme",
]);

function clean(value) {
  return typeof value === "string" ? value.trim() : value;
}

function isPlaceholder(value) {
  const v = clean(value);
  if (v === undefined || v === null) return true;
  return PLACEHOLDERS.has(String(v).toLowerCase());
}

function requireNumber(name, raw, fallback) {
  if (raw === undefined || clean(raw) === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(
      `Environment variable ${name} must be a number, received "${raw}".`
    );
  }
  return n;
}

const rawDb = {
  host: clean(process.env.DB_HOST),
  port: process.env.DB_PORT,
  name: clean(process.env.DB_NAME),
  user: clean(process.env.DB_USER),
  password: process.env.DB_PASSWORD,
};

// "configured" only when every DB_* field is present and the password isn't
// the shipped placeholder
const hasDatabase = Boolean(
  rawDb.host &&
    rawDb.name &&
    rawDb.user &&
    !isPlaceholder(rawDb.password)
);

const googleKey = clean(process.env.GOOGLE_MAPS_API_KEY);
const hasGoogleKey = !isPlaceholder(googleKey);

const pipelineUrl = clean(process.env.PIPELINE_URL);
const hasPipeline = Boolean(pipelineUrl) && !isPlaceholder(pipelineUrl);

// never default to "*" - local Vite dev server only, plus whatever CORS_ORIGINS adds
const DEFAULT_CORS = "http://localhost:5173";
const corsOrigins = (clean(process.env.CORS_ORIGINS) || DEFAULT_CORS)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const env = Object.freeze({
  port: requireNumber("PORT", process.env.PORT, 5000),

  // hasDatabase=false -> pedestrian data degrades to "no live data" (never fabricated)
  hasDatabase,
  db: Object.freeze({
    host: rawDb.host || "localhost",
    port: requireNumber("DB_PORT", rawDb.port, 5432),
    database: rawDb.name || "senseway",
    user: rawDb.user || "postgres",
    password: isPlaceholder(rawDb.password) ? "" : rawDb.password,
    // short timeout so a segment degrades fast instead of the request hanging
    connectionTimeoutMillis: requireNumber(
      "DB_CONNECTION_TIMEOUT_MS",
      process.env.DB_CONNECTION_TIMEOUT_MS,
      2000
    ),
  }),

  // hasGoogleKey=false -> every /api/routes call throws 502 UPSTREAM_UNAVAILABLE
  hasGoogleKey,
  googleMapsApiKey: hasGoogleKey ? googleKey : null,
  googleTimeoutMs: requireNumber(
    "GOOGLE_TIMEOUT_MS",
    process.env.GOOGLE_TIMEOUT_MS,
    4000
  ),

  // hasPipeline=false -> every /api/refuges/nearby call throws 502 UPSTREAM_UNAVAILABLE
  hasPipeline,
  pipelineUrl: hasPipeline ? pipelineUrl : null,
  pipelineTimeoutMs: requireNumber(
    "PIPELINE_TIMEOUT_MS",
    process.env.PIPELINE_TIMEOUT_MS,
    4000
  ),

  corsOrigins: Object.freeze(corsOrigins),

  nodeEnv: clean(process.env.NODE_ENV) || "development",
});

module.exports = env;
