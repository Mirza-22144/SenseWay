const { pool } = require('../db');

const DATASET_URL =
  'https://data.melbourne.vic.gov.au/api/records/1.0/search/?dataset=pedestrian-counting-system-past-hour-counts-per-minute&rows=1000';

async function getValidLocationIds() {
  const res = await pool.query('SELECT Location_ID FROM SENSOR_LOCATION');
  return new Set(res.rows.map((r) => String(r.location_id)));
}

function hasRequiredFields(f) {
  return Boolean(f.location_id != null && f.sensing_datetime);
}

async function ingestMinuteCounts() {
  const validLocationIds = await getValidLocationIds();

  const res = await fetch(DATASET_URL);
  if (!res.ok) {
    throw new Error(`Minute counts fetch failed: ${res.status} ${res.statusText}`);
  }
  const { records } = await res.json();

  let inserted = 0;
  let skippedMissingFields = 0;
  let skippedUnknownSensor = 0;
  let skippedNoUsableCount = 0;
  const seen = new Set();

  for (const record of records) {
    const f = record.fields;

    if (!hasRequiredFields(f)) { skippedMissingFields++; continue; }

    const locationId = String(f.location_id);
    if (!validLocationIds.has(locationId)) { skippedUnknownSensor++; continue; }

    const dedupeKey = `${locationId}|${f.sensing_datetime}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    let total = f.total_of_directions;
    if (total == null && f.direction_1 != null && f.direction_2 != null) {
      total = f.direction_1 + f.direction_2;
    }
    if (total == null) { skippedNoUsableCount++; continue; }

    await pool.query(
      `INSERT INTO PEDESTRIAN_MINUTE_COUNT
         (Sensing_DateTime, Location_ID, Direction_1, Direction_2, Total_of_Direction)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (Sensing_DateTime, Location_ID) DO NOTHING`,
      [f.sensing_datetime, locationId, f.direction_1 ?? null, f.direction_2 ?? null, total]
    );
    inserted++;
  }

  return { inserted, skippedMissingFields, skippedUnknownSensor, skippedNoUsableCount, total: records.length };
}

module.exports = { ingestMinuteCounts };
