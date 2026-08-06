"use strict";

const db = require("../config/database");

/**
 * ALL SQL lives in the repository layer and nowhere else.
 *
 * Conventions used throughout this file, matching the real schema exactly (the
 * ingestion scripts in senseway-data-pipeline/src/ingest are the source of
 * truth):
 *
 *  - Every query is PARAMETERISED with $1, $2, ... - never string
 *    concatenation. This is the primary defence against SQL injection.
 *
 *  - "Longtitude" is MISSPELLED in SENSOR_LOCATION and LANDMARK. We must spell
 *    it wrong in SQL to match the column, and we alias it to the correctly
 *    spelled "longitude" in the result, exactly as the pipeline's
 *    refugeFinder.js does. The same applies to the correctly spelled Latitude.
 *
 *  - Postgres folds unquoted identifiers to lowercase, so `SELECT Location_ID`
 *    would come back as row.location_id. CONVENTION CHOSEN: we alias EVERY
 *    selected column explicitly with `AS snake_case` so the JS row keys are
 *    unambiguous to the next reader and don't depend on remembering the folding
 *    rule.
 *
 *  - The count column is Total_of_Direction (SINGULAR), even though the open
 *    data API field was total_of_directions (plural). We use the DB spelling.
 *
 * Every function returns null when the database is not configured, so services
 * can fall back to mock data. A thrown error (DB unreachable) is also treated as
 * "fall back" by the caller.
 */

/**
 * Nearest sensor to a point, using the same Haversine maths as the pipeline.
 * Returns { sensorId, name, latitude, longitude, distanceMetres } or null.
 */
async function findNearestSensor(latitude, longitude) {
  const sql = `
    SELECT
      s.Location_ID              AS sensor_id,
      s.Sensor_Name              AS name,
      s.Latitude                 AS latitude,
      s.Longtitude               AS longitude,
      6371000 * acos(
        LEAST(1, GREATEST(-1,
          cos(radians($1)) * cos(radians(s.Latitude)) *
          cos(radians(s.Longtitude) - radians($2)) +
          sin(radians($1)) * sin(radians(s.Latitude))
        ))
      )                          AS distance_metres
    FROM SENSOR_LOCATION s
    WHERE s.Latitude IS NOT NULL AND s.Longtitude IS NOT NULL
    ORDER BY distance_metres ASC
    LIMIT 1
  `;
  const result = await db.query(sql, [latitude, longitude]);
  if (!result || result.rows.length === 0) return null;

  const r = result.rows[0];
  return {
    sensorId: String(r.sensor_id),
    name: r.name || null,
    latitude: r.latitude,
    longitude: r.longitude,
    distanceMetres: Math.round(r.distance_metres),
  };
}

/**
 * Historical mean pedestrian count for one sensor, on one day-of-week, at one
 * hour of the day. This IS the forecast model (US2.2): the mean of matching
 * historical rows from PEDESTRIAN_HOUR_COUNT.
 *
 * dayOfWeek is JS convention (0=Sunday..6=Saturday); Postgres EXTRACT(DOW ...)
 * uses the same convention, so they line up.
 *
 * HourDay in the monthly-counts dataset is the hour of the day (0-23).
 *
 * Returns { mean, sampleSize }. sampleSize can be 0 - the caller must treat few
 * or zero rows as "Unknown / low confidence" rather than a fabricated number,
 * because this table is only a thin recent slice of the data (see README).
 */
async function getHourlyMean(sensorId, dayOfWeek, hour) {
  const sql = `
    SELECT
      AVG(h.Total_of_Direction)::float AS mean,
      COUNT(*)::int                    AS sample_size
    FROM PEDESTRIAN_HOUR_COUNT h
    WHERE h.Location_ID = $1
      AND EXTRACT(DOW FROM h.Sensing_Date::date) = $2
      AND h.HourDay = $3
  `;
  const result = await db.query(sql, [sensorId, dayOfWeek, hour]);
  if (!result || result.rows.length === 0) {
    return { mean: null, sampleSize: 0 };
  }
  const r = result.rows[0];
  return {
    mean: r.mean == null ? null : Number(r.mean),
    sampleSize: r.sample_size || 0,
  };
}

/**
 * Most recent minute-level count for a sensor, from PEDESTRIAN_MINUTE_COUNT.
 * Used to score live routes and to decide whether the reading is fresh enough
 * to trust (older than 60 min -> the scoring service returns "Unknown").
 *
 * Returns { count, observedAt } or null.
 */
async function getLatestCount(sensorId) {
  const sql = `
    SELECT
      m.Total_of_Direction AS count,
      m.Sensing_DateTime   AS observed_at
    FROM PEDESTRIAN_MINUTE_COUNT m
    WHERE m.Location_ID = $1
    ORDER BY m.Sensing_DateTime DESC
    LIMIT 1
  `;
  const result = await db.query(sql, [sensorId]);
  if (!result || result.rows.length === 0) return null;

  const r = result.rows[0];
  return {
    count: r.count == null ? null : Number(r.count),
    observedAt: r.observed_at ? new Date(r.observed_at).toISOString() : null,
  };
}

module.exports = { findNearestSensor, getHourlyMean, getLatestCount };
