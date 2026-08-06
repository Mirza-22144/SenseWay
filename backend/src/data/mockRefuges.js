"use strict";

/**
 * Mock sensory-refuge landmarks around Melbourne's CBD.
 *
 * Shape mirrors what the pipeline's /refuge/nearby returns (name, theme,
 * subTheme, latitude, longitude) PLUS the fields our API contract adds. The
 * refuge service computes distanceMetres/walkingMinutes from the caller's
 * origin, so these fixtures carry only their fixed location and the fields we
 * can honestly derive.
 *
 * Fields the open data does NOT contain are null, never invented:
 *   - openNow: there are no opening hours anywhere in the schema.
 *   - seatingAvailable, noiseLevel: not in the landmark dataset.
 * indoorOutdoor is derived from theme/subTheme only where the theme genuinely
 * implies it (a garden is outdoors, a library hall is indoors); null otherwise.
 */

const mockRefuges = [
  {
    name: "State Library Victoria",
    theme: "Place Of Assembly",
    subTheme: "Library",
    latitude: -37.8098,
    longitude: 144.9652,
  },
  {
    name: "Melbourne Town Hall",
    theme: "Place Of Assembly",
    subTheme: "Hall",
    latitude: -37.8148,
    longitude: 144.9669,
  },
  {
    name: "Carlton Gardens",
    theme: "Leisure/Recreation",
    subTheme: "Park/Garden",
    latitude: -37.8056,
    longitude: 144.9713,
  },
  {
    name: "St Paul's Cathedral",
    theme: "Place of Worship",
    subTheme: "Cathedral",
    latitude: -37.8173,
    longitude: 144.9682,
  },
  {
    name: "Fitzroy Gardens",
    theme: "Leisure/Recreation",
    subTheme: "Park/Garden",
    latitude: -37.8127,
    longitude: 144.9797,
  },
];

function getMockRefuges() {
  return JSON.parse(JSON.stringify(mockRefuges));
}

module.exports = { getMockRefuges };
