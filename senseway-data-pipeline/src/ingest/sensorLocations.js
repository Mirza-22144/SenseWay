

const { pool } = require('../db');

const DATASET_URL =
  'https://data.melbourne.vic.gov.au/api/records/1.0/search/?dataset=pedestrian-counting-system-sensor-locations&rows=500';

// Cleaning: reject any record missing the fields we can't function without.
function isValidRecord(fields) {
  return Boolean(
    fields.location_id &&
    fields.latitude != null &&
    fields.longitude != null
  );
}

async function ingestSensorLocations() {
  const res = await fetch(DATASET_URL);
  if (!res.ok) {
    throw new Error(`Sensor locations fetch failed: ${res.status} ${res.statusText}`);
  }
  const { records } = await res.json();

  let inserted = 0;
  let skipped = 0;

  for (const record of records) {
    const f = record.fields;

    if (!isValidRecord(f)) {
      skipped++;
      continue;
    }

    await pool.query(
      `INSERT INTO SENSOR_LOCATION
         (Location_ID, Sensor_Name, Sensor_description, Location_type,
          Status, Latitude, Longtitude, Direction_1, Direction_2, Installation_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (Location_ID) DO UPDATE SET
         Sensor_Name = EXCLUDED.Sensor_Name,
         Status = EXCLUDED.Status,
         Latitude = EXCLUDED.Latitude,
         Longtitude = EXCLUDED.Longtitude`,
      [
        f.location_id,
        f.sensor_name || null,
        f.sensor_description || null,
        f.location_type || null,
        f.status || null,
        f.latitude,
        f.longitude,
        f.direction_1 || null,
        f.direction_2 || null,
        f.installation_date || null,
      ]
    );
    inserted++;
  }

  return { inserted, skipped, total: records.length };
}

module.exports = { ingestSensorLocations };
