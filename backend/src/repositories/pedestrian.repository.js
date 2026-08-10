"use strict";

const db = require("../config/database");

/**
 * All SQL lives in this layer. Conventions, matching the real schema (source
 * of truth: senseway-data-pipeline/src/ingest):
 *  - every query is parameterised ($1, $2, ...) - no string concatenation
 *  - "Longtitude" is misspelled in SENSOR_LOCATION/LANDMARK - kept as-is in
 *    SQL, aliased to correct "longitude" in results
 *  - every selected column is aliased AS snake_case explicitly (Postgres
 *    folds unquoted identifiers to lowercase otherwise)
 *  - count column is Total_of_Direction (singular), matching the DB, not the
 *    open-data API's plural field name
 *
 * Every function returns null when the DB isn't configured or a row isn't
 * found; a thrown error means the DB itself failed.
 */

// nearest sensor to a point, same Haversine maths as the pipeline
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

// forecast model: mean historical count for one sensor, day-of-week, hour.
// dayOfWeek is JS convention (0=Sun..6=Sat), same as Postgres EXTRACT(DOW).
// sampleSize can be 0 - caller must treat that as "Unknown", not fabricate a number.
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

// matches the source dataset's own 15-min refresh cadence
const RECENT_WINDOW_MINUTES = 15;

/**
 * Mean minute-level count for a sensor over the last RECENT_WINDOW_MINUTES.
 * Averaging (not a single newest row) smooths out normal minute-to-minute
 * burstiness - see crowd.js's minuteCountToHourlyRate() for the next step.
 *
 * Window is anchored to the sensor's OWN latest row, not wall-clock NOW() -
 * if ingestion is behind, anchoring to NOW() would wrongly report "no live
 * data" for a sensor that has a slightly older but real reading. Freshness
 * is judged separately downstream by comparing observedAt to NOW().
 *
 * Returns { count, observedAt } or null.
 */
async function getRecentMeanCount(sensorId) {
  const sql = `
    SELECT
      AVG(m.Total_of_Direction)::float AS mean_count,
      MAX(m.Sensing_DateTime)          AS observed_at
    FROM PEDESTRIAN_MINUTE_COUNT m
    WHERE m.Location_ID = $1
      AND m.Sensing_DateTime >= (
        SELECT MAX(m2.Sensing_DateTime)
        FROM PEDESTRIAN_MINUTE_COUNT m2
        WHERE m2.Location_ID = $1
      ) - make_interval(mins => $2::int)
  `;
  const result = await db.query(sql, [sensorId, RECENT_WINDOW_MINUTES]);
  if (!result || result.rows.length === 0) return null;

  const r = result.rows[0];
  // AVG/MAX over zero matching rows still returns one row, with NULLs
  if (r.mean_count == null) return null;

  return {
    count: Number(r.mean_count),
    observedAt: r.observed_at ? new Date(r.observed_at).toISOString() : null,
  };
}

module.exports = { findNearestSensor, getHourlyMean, getRecentMeanCount };
