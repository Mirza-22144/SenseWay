const { pool } = require('../db');

// Switched from the search/1.0 API to the CSV download endpoint.
// The search API's sort=-sensing_datetime was confirmed unreliable -
// it kept returning stale records as "newest" even as the dataset's
// nhits count grew, while the raw CSV export correctly showed current data.
const CSV_URL =
  'https://data.melbourne.vic.gov.au/api/records/1.0/download/?dataset=pedestrian-counting-system-past-hour-counts-per-minute&format=csv';

const BATCH_SIZE = 500;

function parseCsvLine(line) {
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
    const base = i * 5;
    values.push(r.sensingDatetime, r.locationId, r.direction1, r.direction2, r.total);
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
  });
  await pool.query(
    `INSERT INTO PEDESTRIAN_MINUTE_COUNT
       (Sensing_DateTime, Location_ID, Direction_1, Direction_2, Total_of_Direction)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (Sensing_DateTime, Location_ID) DO NOTHING`,
    values
  );
}

async function ingestMinuteCounts() {
  const validLocationIds = await getValidLocationIds();

  const bustUrl = `${CSV_URL}&_=${Date.now()}`;
  const res = await fetch(bustUrl, {
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  });
  if (!res.ok) {
    throw new Error(`Minute counts CSV download failed: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  const lines = text.split('\n').filter((l) => l.trim().length > 0);

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = {
    locationId: header.indexOf('location_id'),
    sensingDatetime: header.indexOf('sensing_datetime'),
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
    const sensingDatetime = cols[idx.sensingDatetime];

    if (!locationId || !sensingDatetime) { skippedMissingFields++; continue; }

    const locId = String(locationId);
    if (!validLocationIds.has(locId)) { skippedUnknownSensor++; continue; }

    const d1 = cols[idx.direction1] ? parseInt(cols[idx.direction1], 10) : null;
    const d2 = cols[idx.direction2] ? parseInt(cols[idx.direction2], 10) : null;
    let total = cols[idx.total] ? parseInt(cols[idx.total], 10) : null;
    if ((total == null || isNaN(total)) && d1 != null && d2 != null) total = d1 + d2;
    if (total == null || isNaN(total)) { skippedNoUsableCount++; continue; }

    batch.push({
      sensingDatetime,
      locationId: locId,
      direction1: isNaN(d1) ? null : d1,
      direction2: isNaN(d2) ? null : d2,
      total,
    });

    if (batch.length >= BATCH_SIZE) {
      await insertBatch(batch);
      inserted += batch.length;
      batch = [];
    }
  }

  if (batch.length > 0) {
    await insertBatch(batch);
    inserted += batch.length;
  }

  return { inserted, skippedMissingFields, skippedUnknownSensor, skippedNoUsableCount, total: lines.length - 1 };
}

module.exports = { ingestMinuteCounts };
