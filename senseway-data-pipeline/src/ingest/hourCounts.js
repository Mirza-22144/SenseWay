const { pool } = require('../db');

const DATASET_URL =
  'https://data.melbourne.vic.gov.au/api/records/1.0/search/?dataset=pedestrian-counting-system-monthly-counts-per-hour&rows=1000';

async function getValidLocationIds() {
  const res = await pool.query('SELECT Location_ID FROM SENSOR_LOCATION');
  return new Set(res.rows.map((r) => String(r.location_id)));
}

function hasRequiredFields(f) {
  return Boolean(f.location_id != null && f.sensing_date && f.hourday != null);
}

async function ingestHourCounts() {
  const validLocationIds = await getValidLocationIds();

  const res = await fetch(DATASET_URL);
  if (!res.ok) {
    throw new Error(`Hourly counts fetch failed: ${res.status} ${res.statusText}`);
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
    if (!validLocationIds.has(locationId)) {
      if (skippedUnknownSensor === 0) console.log('SAMPLE unmatched location_id from API:', JSON.stringify(f.location_id), 'vs DB has:', JSON.stringify([...validLocationIds].slice(0,5)));
      skippedUnknownSensor++;
      continue;
    }

    const dedupeKey = `${locationId}|${f.sensing_date}|${f.hourday}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    let total = f.total_of_directions;
    if (total == null && f.direction_1 != null && f.direction_2 != null) {
      total = f.direction_1 + f.direction_2;
    }
    if (total == null) { skippedNoUsableCount++; continue; }

    await pool.query(
      `INSERT INTO PEDESTRIAN_HOUR_COUNT
         (Location_ID, Sensing_Date, HourDay, ID, Direction_1, Direction_2, Total_of_Direction)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (Location_ID, Sensing_Date, HourDay) DO NOTHING`,
      [locationId, f.sensing_date, f.hourday, f.id || null, f.direction_1 ?? null, f.direction_2 ?? null, total]
    );
    inserted++;
  }

  return { inserted, skippedMissingFields, skippedUnknownSensor, skippedNoUsableCount, total: records.length };
}

module.exports = { ingestHourCounts };
