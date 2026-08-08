// One-time full historical backfill for PEDESTRIAN_HOUR_COUNT.
// Uses the CSV download/export endpoint instead of the search API,
// since the search API caps at ~10,000 total results and this dataset
// has roughly 1.6 million rows. Run this manually from your laptop,
// NOT through the Cloud Run scheduled endpoint (would exceed timeout limits).
//
// Usage: node src/backfill/hourCountsBackfill.js

const { pool } = require('../db');

const CSV_URL =
  'https://data.melbourne.vic.gov.au/api/records/1.0/download/?dataset=pedestrian-counting-system-monthly-counts-per-hour&format=csv';

const BATCH_SIZE = 500;

function parseCsvLine(line) {
  // Simple split - fine here since this dataset's fields don't contain
  // embedded commas or quotes (unlike the landmarks co_ordinates field).
  return line.split(';').map((v) => v.trim());
}

async function getValidLocationIds() {
  const res = await pool.query('SELECT Location_ID FROM SENSOR_LOCATION');
  return new Set(res.rows.map((r) => String(r.location_id)));
}

async function insertBatch(rows) {
  if (rows.length === 0) return;

  const values = [];
  const placeholders = rows.map((r, i) => {
    const base = i * 7;
    values.push(r.locationId, r.sensingDate, r.hourday, r.id, r.direction1, r.direction2, r.total);
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
  });

  await pool.query(
    `INSERT INTO PEDESTRIAN_HOUR_COUNT
       (Location_ID, Sensing_Date, HourDay, ID, Direction_1, Direction_2, Total_of_Direction)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (Location_ID, Sensing_Date, HourDay) DO NOTHING`,
    values
  );
}

async function runBackfill() {
  console.log('Fetching valid sensor IDs...');
  const validLocationIds = await getValidLocationIds();
  console.log(`Found ${validLocationIds.size} valid sensors.`);

  console.log('Downloading full CSV export (this may take a while for ~1.6M rows)...');
  const res = await fetch(CSV_URL);
  if (!res.ok) {
    throw new Error(`CSV download failed: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  console.log(`Downloaded ${lines.length - 1} data rows.`);

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = {
    id: header.indexOf('id'),
    locationId: header.indexOf('location_id'),
    sensingDate: header.indexOf('sensing_date'),
    hourday: header.indexOf('hourday'),
    direction1: header.indexOf('direction_1'),
    direction2: header.indexOf('direction_2'),
    total: header.indexOf('total_of_directions'),
  };

  let inserted = 0;
  let skippedMissingFields = 0;
  let skippedUnknownSensor = 0;
  let skippedNoUsableCount = 0;
  let batch = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const locationId = cols[idx.locationId];
    const sensingDate = cols[idx.sensingDate];
    const hourday = cols[idx.hourday];

    if (!locationId || !sensingDate || hourday === undefined || hourday === '') {
      skippedMissingFields++;
      continue;
    }
    if (!validLocationIds.has(String(locationId))) {
      skippedUnknownSensor++;
      continue;
    }

    let total = cols[idx.total] ? parseInt(cols[idx.total], 10) : null;
    const d1 = cols[idx.direction1] ? parseInt(cols[idx.direction1], 10) : null;
    const d2 = cols[idx.direction2] ? parseInt(cols[idx.direction2], 10) : null;
    if (total == null && d1 != null && d2 != null) total = d1 + d2;
    if (total == null || isNaN(total)) {
      skippedNoUsableCount++;
      continue;
    }

    batch.push({
      locationId: String(locationId),
      sensingDate,
      hourday: parseInt(hourday, 10),
      id: cols[idx.id] || null,
      direction1: isNaN(d1) ? null : d1,
      direction2: isNaN(d2) ? null : d2,
      total,
    });

    if (batch.length >= BATCH_SIZE) {
      await insertBatch(batch);
      inserted += batch.length;
      batch = [];
      if (inserted % 5000 === 0) console.log(`Inserted ${inserted} rows so far...`);
    }
  }

  if (batch.length > 0) {
    await insertBatch(batch);
    inserted += batch.length;
  }

  console.log('--- BACKFILL COMPLETE ---');
  console.log({ inserted, skippedMissingFields, skippedUnknownSensor, skippedNoUsableCount });
  process.exit(0);
}

runBackfill().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
