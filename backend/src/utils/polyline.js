"use strict";

// decodes Google's Encoded Polyline format into lat/lon vertices, so route
// segments can be scored point by point (no third-party dependency)
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
