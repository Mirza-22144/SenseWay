// Mirrors backend/src/utils/geo.js MELBOURNE_BOUNDS.
export const MELBOURNE_BOUNDS = Object.freeze({
  latMin: -38.6,
  latMax: -37.4,
  lonMin: 144.4,
  lonMax: 145.6,
});

export function isWithinMelbourne(latitude, longitude) {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    latitude >= MELBOURNE_BOUNDS.latMin &&
    latitude <= MELBOURNE_BOUNDS.latMax &&
    longitude >= MELBOURNE_BOUNDS.lonMin &&
    longitude <= MELBOURNE_BOUNDS.lonMax
  );
}
