const { pool } = require('../db');

const REFUGE_THEMES = [
  'Leisure/Recreation',
  'Place Of Assembly',
  'Place of Worship',
];

async function findNearbyRefuges(lat, lon, radiusMetres = 300, limit = 10) {
  if (lat == null || lon == null) {
    throw new Error('lat and lon are required');
  }

  const result = await pool.query(
    `SELECT feature_name, theme, sub_theme, latitude, longtitude, distance_metres
     FROM (
       SELECT
         l.feature_name,
         c.theme,
         c.sub_theme,
         l.Latitude AS latitude,
         l.Longtitude AS longtitude,
         6371000 * acos(
           LEAST(1, GREATEST(-1,
             cos(radians($1)) * cos(radians(l.Latitude)) *
             cos(radians(l.Longtitude) - radians($2)) +
             sin(radians($1)) * sin(radians(l.Latitude))
           ))
         ) AS distance_metres
       FROM LANDMARK l
       JOIN LANDMARK_CATEGORY c ON l.Category_id = c.Category_id
       WHERE c.theme = ANY($3)
     ) sub
     WHERE distance_metres < $4
     ORDER BY distance_metres ASC
     LIMIT $5`,
    [lat, lon, REFUGE_THEMES, radiusMetres, limit]
  );

  return result.rows.map((r) => ({
    name: r.feature_name,
    theme: r.theme,
    subTheme: r.sub_theme,
    latitude: r.latitude,
    longitude: r.longtitude,
    distanceMetres: Math.round(r.distance_metres),
  }));
}

module.exports = { findNearbyRefuges, REFUGE_THEMES };
