"use strict";

const { Pool } = require("pg");
const env = require("./env");

/**
 * Lazily-constructed pg Pool - built on first query, not at import time, so
 * /api/health never touches the database. Note: this backend uses discrete
 * DB_* env vars; senseway-data-pipeline uses a single DATABASE_URL instead -
 * two services, one database, two conventions, intentional (see README).
 */

let pool = null;

function isConfigured() {
  return env.hasDatabase;
}

// builds the pool on first call, reuses it after
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

  // prevents an idle-client error from crashing the whole process
  pool.on("error", (err) => {
    console.error("[database] unexpected idle client error:", err.message);
  });

  return pool;
}

// returns null when the DB isn't configured; throws on a genuine query error
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

module.exports = { query, close };
