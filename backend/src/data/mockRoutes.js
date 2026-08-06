"use strict";

/**
 * Mock candidate walking routes across Melbourne's CBD.
 *
 * These are RAW candidates: geometry + per-segment crowd data only. The route
 * service derives everything else (route-level score, ratings, ordering, the
 * four-state distance buckets, dataState, sensorCoverage, exceedsThreshold vs
 * the caller's threshold, cross-route trade-offs) so the scoring rules live in
 * exactly one place and behave identically for mock and live data.
 *
 * Each segment carries:
 *   - from/to lat/lon
 *   - lengthMetres  (segment lengths sum to the route's total distance, so the
 *     four distance buckets provably sum to the route total)
 *   - street        (named for covered segments; used for the AC 1.1.2 reason)
 *   - hasLiveData   (false => uncovered: AC 1.2.1 neutral-grey, NEVER scored)
 *   - crowdScore    (present only when hasLiveData is true)
 *
 * Deliberate shape (so the calmest-first product visibly does something):
 *   - route-2 "Via Bourke Street Mall" is FASTEST (15 min) and MOST crowded
 *     (mean ~79, High) - the fastest route is the worst route.
 *   - route-1 "Via Little Collins Street" is calm (mean ~24, Low), 4 min slower.
 *   - route-3 "Via Flinders Lane" is Moderate AND has one uncovered segment, so
 *     it exercises partial sensor coverage and the noData distance bucket.
 *
 * historicalPeakScore is the "usual" score at each route's busiest point, used
 * to phrase the plain-language rating reason ("higher/lower/typical than usual").
 *
 * Coordinates are realistic CBD points but approximate - illustrative mock data,
 * not surveyed geometry. All segment data is timestamped "now" by the service,
 * so in mock mode routes present as fresh live data (dataState "live"),
 * letting the frontend build the happy path. Top-level dataSource stays "mock".
 */

const mockRoutes = [
  {
    routeId: "route-1",
    summary: "Via Little Collins Street",
    durationMinutes: 19,
    polyline: "mock~littlecollins~b1n3",
    averageCountPerHour: 412,
    historicalPeakScore: 40,
    sensorsUsed: [
      { sensorId: "34", name: "Flinders St-Elizabeth St (East)", distanceMetres: 45 },
      { sensorId: "22", name: "Little Collins St-Swanston St (West)", distanceMetres: 60 },
      { sensorId: "18", name: "Collins Place (South)", distanceMetres: 80 },
    ],
    segments: [
      { fromLatitude: -37.8136, fromLongitude: 144.9631, toLatitude: -37.8149, toLongitude: 144.9642, lengthMetres: 360, street: "Flinders Street", hasLiveData: true, crowdScore: 12 },
      { fromLatitude: -37.8149, fromLongitude: 144.9642, toLatitude: -37.8161, toLongitude: 144.9651, lengthMetres: 380, street: "Elizabeth Street", hasLiveData: true, crowdScore: 20 },
      { fromLatitude: -37.8161, fromLongitude: 144.9651, toLatitude: -37.8172, toLongitude: 144.9662, lengthMetres: 360, street: "Little Collins Street", hasLiveData: true, crowdScore: 38 },
      { fromLatitude: -37.8172, fromLongitude: 144.9662, toLatitude: -37.8183, toLongitude: 144.9671, lengthMetres: 320, street: "Exhibition Street", hasLiveData: true, crowdScore: 26 },
    ],
    congestionPoints: [
      { name: "Swanston St / Collins St", latitude: -37.8161, longitude: 144.9651, crowdScore: 38 },
    ],
    bypassedAreas: [
      { name: "Bourke Street Mall", latitude: -37.8136, longitude: 144.9648, crowdScore: 88, reason: "Pedestrian density above your threshold" },
      { name: "Flinders St Station underpass", latitude: -37.8183, longitude: 144.9671, crowdScore: 81, reason: "Pedestrian density above your threshold" },
    ],
  },
  {
    routeId: "route-2",
    summary: "Via Bourke Street Mall",
    durationMinutes: 15,
    polyline: "mock~bourkemall~f4st",
    averageCountPerHour: 1750,
    historicalPeakScore: 70,
    sensorsUsed: [
      { sensorId: "2", name: "Bourke Street Mall (North)", distanceMetres: 25 },
      { sensorId: "3", name: "Bourke Street Mall (South)", distanceMetres: 30 },
      { sensorId: "5", name: "Melbourne Central", distanceMetres: 55 },
    ],
    segments: [
      { fromLatitude: -37.8136, fromLongitude: 144.9631, toLatitude: -37.8144, toLongitude: 144.9648, lengthMetres: 300, street: "Swanston Street", hasLiveData: true, crowdScore: 70 },
      { fromLatitude: -37.8144, fromLongitude: 144.9648, toLatitude: -37.8152, toLongitude: 144.9659, lengthMetres: 280, street: "Bourke Street", hasLiveData: true, crowdScore: 85 },
      { fromLatitude: -37.8152, fromLongitude: 144.9659, toLatitude: -37.8168, toLongitude: 144.9665, lengthMetres: 320, street: "Bourke Street Mall", hasLiveData: true, crowdScore: 90 },
      { fromLatitude: -37.8168, fromLongitude: 144.9665, toLatitude: -37.8183, toLongitude: 144.9671, lengthMetres: 280, street: "Lonsdale Street", hasLiveData: true, crowdScore: 72 },
    ],
    congestionPoints: [
      { name: "Bourke Street Mall", latitude: -37.8144, longitude: 144.9648, crowdScore: 88 },
      { name: "Bourke St / Swanston St", latitude: -37.8152, longitude: 144.9659, crowdScore: 90 },
    ],
    bypassedAreas: [],
  },
  {
    routeId: "route-3",
    summary: "Via Flinders Lane",
    durationMinutes: 17,
    polyline: "mock~flinderslane~c2wd",
    averageCountPerHour: 980,
    historicalPeakScore: 55,
    sensorsUsed: [
      { sensorId: "9", name: "Flinders Lane-Degraves St", distanceMetres: 40 },
      { sensorId: "12", name: "Flinders La-Elizabeth St", distanceMetres: 65 },
    ],
    segments: [
      { fromLatitude: -37.8136, fromLongitude: 144.9631, toLatitude: -37.8151, toLongitude: 144.9639, lengthMetres: 340, street: "Flinders Street", hasLiveData: true, crowdScore: 40 },
      { fromLatitude: -37.8151, fromLongitude: 144.9639, toLatitude: -37.8164, toLongitude: 144.9652, lengthMetres: 320, street: "Degraves Street", hasLiveData: true, crowdScore: 55 },
      { fromLatitude: -37.8164, fromLongitude: 144.9652, toLatitude: -37.8175, toLongitude: 144.9663, lengthMetres: 340, street: "Flinders Lane", hasLiveData: true, crowdScore: 60 },
      // Uncovered segment: no sensor nearby, so NO crowd score. AC 1.2.1
      // neutral-grey / "no live data" state. Exercises partial coverage.
      { fromLatitude: -37.8175, fromLongitude: 144.9663, toLatitude: -37.8183, toLongitude: 144.9671, lengthMetres: 300, street: null, hasLiveData: false, crowdScore: null },
    ],
    congestionPoints: [
      { name: "Degraves St laneway", latitude: -37.8164, longitude: 144.9652, crowdScore: 60 },
    ],
    bypassedAreas: [
      { name: "Bourke Street Mall", latitude: -37.8144, longitude: 144.9648, crowdScore: 88, reason: "Pedestrian density above your threshold" },
    ],
  },
];

// Deep clone on read so callers can safely mutate the enriched copy without
// corrupting the shared fixture between requests.
function getMockRoutes() {
  return JSON.parse(JSON.stringify(mockRoutes));
}

module.exports = { getMockRoutes };
