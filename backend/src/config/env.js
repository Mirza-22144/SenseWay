"use strict";

/**
 * Single source of truth for environment configuration.
 *
 * WHY this file exists: every other module imports the frozen `env` object from
 * here and NEVER touches process.env directly. That means a misconfigured
 * deployment fails loudly at startup with a clear message, instead of failing
 * three layers deep at 11pm when someone finally hits the code path that reads
 * an undefined variable.
 *
 * WHY absence isn't a hard startup crash: Google/DB/pipeline credentials are
 * all REQUIRED for this app to actually work (there is no mock fallback left
 * anywhere in the services) - but env.js still boots without them rather than
 * throwing, so /api/health stays up and the specific endpoint that needs the
 * missing credential returns an honest 502 UPSTREAM_UNAVAILABLE instead of the
 * whole process refusing to start. We DO throw when a value that *is* present
 * is malformed (e.g. PORT is not a number), because that is a genuine mistake
 * rather than a missing credential.
 */

// Placeholder values shipped in .env.example. If someone copies .env.example to
// .env without editing it, we must treat these as "absent" rather than trying
// to connect with junk and hanging. Compared case-insensitively and trimmed.
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

// The database is considered "configured" only when every DB_* field is present
// AND the password is not the shipped placeholder. Otherwise we run on mock
// pedestrian data. This is what keeps `npm run dev` working with no .env at all.
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

// CORS: NEVER default to "*". A bare allow-all lets any website on the internet
// make authenticated-by-cookie requests from a victim's browser. Default is the
// local Vite dev server only; production origins are added via CORS_ORIGINS.
const DEFAULT_CORS = "http://localhost:5173";
const corsOrigins = (clean(process.env.CORS_ORIGINS) || DEFAULT_CORS)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const env = Object.freeze({
  port: requireNumber("PORT", process.env.PORT, 5000),

  // Database. hasDatabase=false means pedestrian data degrades honestly
  // (segments render as "no live data", never fabricated) - see
  // pedestrian.service.js. Required for AC 1.2.1/1.1.2 to show real data.
  hasDatabase,
  db: Object.freeze({
    host: rawDb.host || "localhost",
    port: requireNumber("DB_PORT", rawDb.port, 5432),
    database: rawDb.name || "senseway",
    user: rawDb.user || "postgres",
    password: isPlaceholder(rawDb.password) ? "" : rawDb.password,
    // Short timeout so a segment degrades to "no live data" fast rather than
    // the request hanging for the default 30s.
    connectionTimeoutMillis: requireNumber(
      "DB_CONNECTION_TIMEOUT_MS",
      process.env.DB_CONNECTION_TIMEOUT_MS,
      2000
    ),
  }),

  // Google Routes API. Required: hasGoogleKey=false makes every /api/routes
  // call throw 502 UPSTREAM_UNAVAILABLE (see google.service.js) - there is no
  // route-planning feature without it.
  hasGoogleKey,
  googleMapsApiKey: hasGoogleKey ? googleKey : null,
  googleTimeoutMs: requireNumber(
    "GOOGLE_TIMEOUT_MS",
    process.env.GOOGLE_TIMEOUT_MS,
    4000
  ),

  // senseway-data-pipeline refuge endpoint. Required: hasPipeline=false makes
  // every /api/refuges/nearby call throw 502 UPSTREAM_UNAVAILABLE (AC 2.1.1's
  // own "Refuge information is currently unavailable." exception).
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
