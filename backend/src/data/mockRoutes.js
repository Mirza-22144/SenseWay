"use strict";

/**
 * Mock candidate walking routes across Melbourne's CBD.
 *
 * These are RAW candidates: geometry + per-segment crowd scores only. The route
 * service derives everything else (route-level score, ratings, ordering,
 * exceedsThreshold vs the caller's threshold, minutesSlowerThanFastest) so that
 * the scoring rules live in exactly one place and behave identically for mock
 * and live data.
 *
 * Deliberate shape of the data (so the frontend and the calmest-first ranking
 * visibly do something):
 *   - route-2 "Via Bourke Street Mall" is the FASTEST (15 min) and the MOST
 *     crowded (mean ~79, High). The fastest route is the worst route.
 *   - route-1 "Via Little Collins Street" is calm (mean ~24, Low) but 4 minutes
 *     slower.
 *   - route-3 "Via Flinders Lane" sits in between (Moderate).
 *
 * Because every segment scores >= 12, a low crowdThreshold (e.g. 10) makes every
 * route contain an over-threshold segment, which exercises the
 * noLowSensoryRouteAvailable path with real logic rather than a special fixture.
 *
 * Coordinates are realistic CBD points but approximate - they are illustrative
 * mock data, not surveyed geometry.
 */

const mockRoutes = [
  {
    routeId: "route-1",
    summary: "Via Little Collins Street",
    durationMinutes: 19,
    distanceMetres: 1420,
    // A short fake encoded polyline placeholder - the frontend treats it as an
    // opaque string. Live routes carry the real Google-encoded polyline.
    polyline: "mock~littlecollins~b1n3",
    averageCountPerHour: 412,
    sensorsUsed: [
      { sensorId: "34", name: "Flinders St-Elizabeth St (East)", distanceMetres: 45 },
      { sensorId: "22", name: "Little Collins St-Swanston St (West)", distanceMetres: 60 },
      { sensorId: "18", name: "Collins Place (South)", distanceMetres: 80 },
    ],
    segments: [
      { fromLatitude: -37.8136, fromLongitude: 144.9631, toLatitude: -37.8149, toLongitude: 144.9642, crowdScore: 12 },
      { fromLatitude: -37.8149, fromLongitude: 144.9642, toLatitude: -37.8161, toLongitude: 144.9651, crowdScore: 20 },
      { fromLatitude: -37.8161, fromLongitude: 144.9651, toLatitude: -37.8172, toLongitude: 144.9662, crowdScore: 38 },
      { fromLatitude: -37.8172, fromLongitude: 144.9662, toLatitude: -37.8183, toLongitude: 144.9671, crowdScore: 26 },
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
    distanceMetres: 1180,
    polyline: "mock~bourkemall~f4st",
    averageCountPerHour: 1750,
    sensorsUsed: [
      { sensorId: "2", name: "Bourke Street Mall (North)", distanceMetres: 25 },
      { sensorId: "3", name: "Bourke Street Mall (South)", distanceMetres: 30 },
      { sensorId: "5", name: "Melbourne Central", distanceMetres: 55 },
    ],
    segments: [
      { fromLatitude: -37.8136, fromLongitude: 144.9631, toLatitude: -37.8144, toLongitude: 144.9648, crowdScore: 70 },
      { fromLatitude: -37.8144, fromLongitude: 144.9648, toLatitude: -37.8152, toLongitude: 144.9659, crowdScore: 85 },
      { fromLatitude: -37.8152, fromLongitude: 144.9659, toLatitude: -37.8168, toLongitude: 144.9665, crowdScore: 90 },
      { fromLatitude: -37.8168, fromLongitude: 144.9665, toLatitude: -37.8183, toLongitude: 144.9671, crowdScore: 72 },
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
    distanceMetres: 1300,
    polyline: "mock~flinderslane~c2wd",
    averageCountPerHour: 980,
    sensorsUsed: [
      { sensorId: "9", name: "Flinders Lane-Degraves St", distanceMetres: 40 },
      { sensorId: "12", name: "Flinders La-Elizabeth St", distanceMetres: 65 },
    ],
    segments: [
      { fromLatitude: -37.8136, fromLongitude: 144.9631, toLatitude: -37.8151, toLongitude: 144.9639, crowdScore: 40 },
      { fromLatitude: -37.8151, fromLongitude: 144.9639, toLatitude: -37.8164, toLongitude: 144.9652, crowdScore: 55 },
      { fromLatitude: -37.8164, fromLongitude: 144.9652, toLatitude: -37.8175, toLongitude: 144.9663, crowdScore: 60 },
      { fromLatitude: -37.8175, fromLongitude: 144.9663, toLatitude: -37.8183, toLongitude: 144.9671, crowdScore: 50 },
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
