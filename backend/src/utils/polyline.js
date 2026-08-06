"use strict";

/**
 * Google's Encoded Polyline Algorithm decoder.
 *
 * WHY this is here: the real Google Routes API returns route geometry as an
 * encoded polyline string. To score a live route segment-by-segment we need the
 * actual lat/lon vertices, so we decode them here. This has no third-party
 * dependency; the algorithm is a documented, stable Google spec.
 *
 * Only exercised on the LIVE path (GOOGLE_MAPS_API_KEY present). The mock path
 * ships pre-decoded coordinates, so this decoder is not covered by the mock
 * tests - noted honestly in the README.
 */
function decode(encoded, precision = 5) {
  if (typeof encoded !== "string" || encoded.length === 0) return [];

  const factor = Math.pow(10, precision);
  const coordinates = [];
  let index = 0;
  let lat = 0;
  let lon = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lon += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push({ latitude: lat / factor, longitude: lon / factor });
  }

  return coordinates;
}

module.exports = { decode };
