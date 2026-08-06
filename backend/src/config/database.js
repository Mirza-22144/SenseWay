"use strict";

const { Pool } = require("pg");
const env = require("./env");

/**
 * Lazily-constructed pg Pool.
 *
 * WHY lazy: /api/health must NEVER touch the database (a health check that can
 * fail for someone else's outage is worse than no health check). We also want
 * the app to boot and serve mock data when Postgres is down or unconfigured.
 * So we do not open a pool at import time - we build it on first query, and if
 * the DB is not configured at all we do not build one and callers fall back to
 * mock data.
 *
 * This backend uses the discrete DB_* variables (Part 6 of the brief). The
 * senseway-data-pipeline uses a single DATABASE_URL instead - two services,
 * one database, two conventions. That divergence is intentional and flagged in
 * the README; we do not read DATABASE_URL here.
 */

let pool = null;

function isConfigured() {
  return env.hasDatabase;
}

function getPool() {
  if (!isConfigured()) return null;
  if (pool) return pool;

  pool = new Pool({
    host: env.db.host,
    port: env.db.port,
    database: env.db.database,
    user: env.db.user,
    password: env.db.password,
    connectionTimeoutMillis: env.db.connectionTimeoutMillis,
    max: 5,
  });

  // A pool-level error listener prevents an idle client error from crashing the
  // whole process (the pipeline relies on the same pattern).
  pool.on("error", (err) => {
    console.error("[database] unexpected idle client error:", err.message);
  });

  return pool;
}

/**
 * Run a parameterised query. Returns null when the DB is not configured so the
 * caller can fall back to mock data. Throws only on a genuine query error
 * (which the caller also treats as "fall back to mock", logging a warning).
 */
async function query(text, params) {
  const p = getPool();
  if (!p) return null;
  return p.query(text, params);
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { getPool, query, isConfigured, close };
