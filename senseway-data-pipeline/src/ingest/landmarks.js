const { pool } = require('../db');

const DATASET_URL =
  'https://data.melbourne.vic.gov.au/api/records/1.0/search/?dataset=landmarks-and-places-of-interest-including-schools-theatres-health-services-spor&rows=1000';

function parseCoordinates(coord) {
  if (coord == null) return { lat: null, lon: null };

  if (typeof coord === 'string') {
    const parts = coord.split(',').map((s) => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return { lat: parts[0], lon: parts[1] };
    }
    return { lat: null, lon: null };
  }

  if (Array.isArray(coord) && coord.length === 2) {
    return { lat: coord[0], lon: coord[1] };
  }

  if (typeof coord === 'object') {
    const lat = coord.lat ?? coord.latitude;
    const lon = coord.lon ?? coord.lng ?? coord.longitude;
    if (lat != null && lon != null) return { lat, lon };
  }

  return { lat: null, lon: null };
}

async function getOrCreateCategoryId(theme, subTheme) {
  const existing = await pool.query(
    'SELECT Category_id FROM LANDMARK_CATEGORY WHERE theme = $1 AND sub_theme = $2',
    [theme, subTheme]
  );
  if (existing.rows.length > 0) return existing.rows[0].category_id;

  const inserted = await pool.query(
    'INSERT INTO LANDMARK_CATEGORY (theme, sub_theme) VALUES ($1, $2) RETURNING Category_id',
    [theme, subTheme]
  );
  return inserted.rows[0].category_id;
}

async function ingestLandmarks() {
  const res = await fetch(DATASET_URL);
  if (!res.ok) {
    throw new Error(`Landmarks fetch failed: ${res.status} ${res.statusText}`);
  }
  const { records } = await res.json();

  let inserted = 0;
  let skippedMissingFields = 0;
  let skippedBadCoordinates = 0;

  const categoryCache = new Map();

  for (const record of records) {
    const f = record.fields;

    if (!f.theme || !f.feature_name) {
      skippedMissingFields++;
      continue;
    }

    const { lat, lon } = parseCoordinates(f.co_ordinates);
    if (lat == null || lon == null) {
      skippedBadCoordinates++;
      continue;
    }

    const cacheKey = `${f.theme}|${f.sub_theme || ''}`;
    let categoryId = categoryCache.get(cacheKey);
    if (categoryId == null) {
      categoryId = await getOrCreateCategoryId(f.theme, f.sub_theme || null);
      categoryCache.set(cacheKey, categoryId);
    }

    await pool.query(
      `INSERT INTO LANDMARK (Category_id, feature_name, Latitude, Longtitude)
       VALUES ($1, $2, $3, $4)`,
      [categoryId, f.feature_name, lat, lon]
    );
    inserted++;
  }

  return {
    inserted,
    skippedMissingFields,
    skippedBadCoordinates,
    categoriesCreated: categoryCache.size,
    total: records.length,
  };
}

module.exports = { ingestLandmarks };
