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

// The source dataset (Pedestrian Counting System - Past Hour) itself only
// refreshes every 15 minutes, so a single poll typically lands a batch of
// ~15 individual one-minute rows at once, not a steady one-per-minute
// trickle. Matches that cadence, not chosen arbitrarily.
const RECENT_WINDOW_MINUTES = 15;

/**
 * Mean minute-level count for a sensor over the last RECENT_WINDOW_MINUTES,
 * from PEDESTRIAN_MINUTE_COUNT. Used to score live routes and to decide
 * whether the reading is fresh enough to trust (dataStateFor treats data
 * older than the staleness horizon as "stale"/"unavailable").
 *
 * WHY a window mean, not a single row: pedestrian counts are naturally
 * bursty minute to minute (a signal-cycle gap, a tram unloading), so taking
 * only the single newest row and extrapolating it x60 (minuteCountToHourlyRate)
 * amplifies one noisy minute into a 60x swing in the hourly-scale score, and
 * two runs a minute apart could land in different sensory bands even though
 * the corridor hasn't actually changed. Averaging the whole recent batch is a
 * far steadier "how busy is it right now" without losing freshness, since the
 * window is exactly as wide as the source's own refresh cadence.
 *
 * Returns { count, observedAt } or null. count is the MEAN per-minute rate
 * across the window - averaging first, then x60 in minuteCountToHourlyRate(),
 * is equivalent to x60-ing each row and then averaging.
 *
 * The window is anchored to this sensor's OWN latest row, not to wall-clock
 * NOW() - deliberately, not an oversight. If ingestion is behind (e.g. the
 * pipeline hasn't polled in the last 30+ minutes), anchoring to NOW() would
 * find zero rows and report "no live data" even though we genuinely have a
 * reading - just an old one. That would silently swallow AC 1.1.2's "stale"
 * state (a route should still show its rating with a "may be outdated"
 * warning, per scoring.service.js's isStale/STALE_AFTER_MS) and misreport it
 * as "unavailable" instead. Anchoring to the sensor's own latest timestamp
 * means we always average whatever the most recent batch actually was, and
 * leave the freshness judgement entirely to the existing staleness check
 * downstream, which still compares the real observedAt to NOW().
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
  // AVG()/MAX() over zero matching rows still returns one row, with NULLs -
  // that means "no rows for this sensor at all", not "a reading of zero".
  if (r.mean_count == null) return null;

  return {
    count: Number(r.mean_count),
    observedAt: r.observed_at ? new Date(r.observed_at).toISOString() : null,
  };
}

module.exports = { findNearestSensor, getHourlyMean, getRecentMeanCount, RECENT_WINDOW_MINUTES };
