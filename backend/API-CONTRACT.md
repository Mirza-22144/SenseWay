# SenseWay Backend — API Contract

Version: onboarding iteration, aligned to the signed-off **User stories &
acceptance criteria** (US1.1, US1.2, US2.1). Base URL in development:
`http://localhost:5000`.

Every response, success or failure, is JSON. Every example below was **copied
from the real running server** (mock mode, no credentials), not hand-written.
Timestamps will differ per request.

> `/api/routes/reroute` and `/api/forecast` also exist but sit **outside the
> current acceptance-criteria scope** (they map to US1.3 / US2.2, which are not
> in the signed-off document). They are kept and working, pending team
> confirmation. See README.

---

## Conventions

- Sensory vocabulary is exactly **`Low` / `Moderate` / `High` / `Unknown`**.
- Crowd scores are integers `0–100`. Bands: `0–30` Low, `31–70` Moderate,
  `71–100` High. Uncovered segments carry **no score** (`null`) and rate
  `Unknown`.
- `dataSource` = provenance: `"mock"` / `"live"` / `"partial"`.
- `dataState` (per route) = the *state the UI keys its message off*: `"live"` /
  `"stale"` / `"unavailable"`. This is **not** the same as `dataSource`: in mock
  mode the fixtures present as fresh (`dataState:"live"`) so the frontend can
  build the happy path, while `dataSource` stays `"mock"`.

---

## AC exception → response field map (read this first)

This is the most useful table for the frontend: every exception condition in the
acceptance criteria, and the exact field + value to key the message off. No
guessing required.

| AC | Exception / message | Key off |
|----|--------------------|---------|
| 1.1.1 | "Live sensory data unavailable" | any `routes[].dataState === "unavailable"` |
| 1.1.1 | "No routes available for these locations." | `noRoutesAvailable === true` (routes `[]`) |
| 1.1.1 | "Please enter a valid Melbourne CBD location." | 400 `INVALID_REQUEST` with a detail containing **"Please enter a valid Melbourne CBD location"** |
| 1.1.1 | up to three route options | `routes.length ≤ 3` (recommended = `recommendedRouteId`) |
| 1.1.2 | sensory rating + contributing data + last updated | `routes[].sensoryRating`, `.contributingFactors`, `.dataUpdatedAt` |
| 1.1.2 | plain-language reason | `routes[].ratingReason` (render verbatim) |
| 1.1.2 | "Detailed sensory data unavailable for this route." | `routes[].dataState === "unavailable"` |
| 1.1.2 | "Sensory data may be outdated." | `routes[].dataState === "stale"` (older than 30 min) |
| 1.2.1 | green / amber / red / **grey** legend (four states) | `routes[].segments[].sensoryRating` ∈ Low/Moderate/High/**Unknown**; `.hasLiveData` |
| 1.2.1 | "Live sensory data unavailable" (whole route grey) | `routes[].dataState === "unavailable"` (equivalently `sensorCoverage === "none"`) |
| 1.2.1 | "Our sensor network does not cover this route." | `routes[].sensorCoverage === "none"` |
| 1.2.2 | "220m through high-crowd areas" | `routes[].highCrowdDistanceMetres` |
| 1.2.2 | "No high-crowd areas on this route." | `routes[].highCrowdDistanceMetres === 0` |
| 1.2.2 | travel time / total distance | `routes[].durationMinutes`, `.distanceMetres` |
| 1.2.3 | show the quieter alternative card | `quieterAlternativeRouteId` (the route id, or `null`) |
| 1.2.3 | "+4 min" trade-off | that route's `minutesSlowerThanFastest` (or `minutesSlowerThanRecommended`) |
| 1.2.3 | "avoids 200m of high-crowd area" | that route's `highCrowdDistanceSavedMetres` |
| 1.2.3 | "No suitable quieter alternative available." | `quieterAlternativeRouteId === null` |
| 1.2.3 | no alternative card when data unavailable | `quieterAlternativeRouteId === null` when recommended `dataState === "unavailable"` |
| 2.1.1 | list of refuges, nearest first | `GET /api/refuges/nearby` → `refuges` (sorted by `walkingMinutes` asc) |
| 2.1.1 | "No nearby sensory refuges found." | `count === 0` |
| 2.1.1 | name / type / walking time / attributes | `refuges[].name`, `.refugeType`, `.walkingMinutes`, `.attributes` |
| 2.1.2 | "Opening hours not available." | `refuges[].openingHoursToday === null` (and top-level `openingHoursKnown === false`) |
| 2.1.2 | photo / default icon by type | `refuges[].photoUrl === null` → use `refugeType` for the icon |
| 2.1.2 | "attributes unavailable" → name/type/time only | `refuges[].attributes.length === 0` |
| 2.1.2 | closed indoor venue disables directions | `refuges[].indoorOutdoor` (`"indoor"` vs `"outdoor"`; `null` if ambiguous) — **note: we have no opening hours, so open/closed cannot be determined; see README** |
| 2.1.3 | directions to a refuge, same indicator | `POST /api/routes` with the refuge lat/lon as `destination` (returns the same route shape + `sensoryRating`) |
| 2.1.3 | "Unable to generate directions to this refuge." | `noRoutesAvailable === true` |

---

## GET /api/health

Liveness only. Never touches the database, Google, or the pipeline.

```json
{ "status": "ok", "service": "senseway-backend", "timestamp": "2026-08-06T14:45:47.427Z" }
```

## GET /

Unchanged legacy welcome route. `200 text/html`: `Welcome to SenseWay Backend`

---

## POST /api/routes

Recommend the calmest route (calmest first, up to three), with the fastest and
the quieter alternative identified.

**Request** (`departureTime`, `preferences` optional; defaults now / avoid=true /
threshold=70):
```json
{
  "start":       { "latitude": -37.8136, "longitude": 144.9631 },
  "destination": { "latitude": -37.8183, "longitude": 144.9671 },
  "departureTime": "2026-08-06T08:15:00+10:00",
  "preferences": { "avoidHighDensity": true, "crowdThreshold": 70 }
}
```

**200** (top-level + the recommended route; `route-3` segment shown to
illustrate the uncovered/grey state — all real output):
```json
{
    "query": { "start": {...}, "destination": {...}, "departureTime": "2026-08-05T22:15:00.000Z", "preferences": { "avoidHighDensity": true, "crowdThreshold": 70 } },
    "noRoutesAvailable": false,
    "recommendedRouteId": "route-1",
    "fastestRouteId": "route-2",
    "quieterAlternativeRouteId": "route-1",
    "alternativeMaxExtraMinutes": 10,
    "noLowSensoryRouteAvailable": false,
    "notice": null,
    "routes": [
        {
            "routeId": "route-1",
            "summary": "Via Little Collins Street",
            "durationMinutes": 19,
            "distanceMetres": 1420,
            "minutesSlowerThanFastest": 4,
            "minutesSlowerThanRecommended": 0,
            "highCrowdDistanceSavedMetres": 880,
            "polyline": "mock~littlecollins~b1n3",
            "crowdScore": 24,
            "sensoryRating": "Low",
            "ratingReason": "This route has a Low sensory rating because it avoids the busiest pedestrian areas and primarily passes through low-density streets.",
            "dataState": "live",
            "sensorCoverage": "full",
            "confidence": "high",
            "dataUpdatedAt": "2026-08-06T14:45:47.448Z",
            "highCrowdDistanceMetres": 0,
            "moderateCrowdDistanceMetres": 360,
            "lowCrowdDistanceMetres": 1060,
            "noDataDistanceMetres": 0,
            "contributingFactors": {
                "pedestrianDensity": { "averageCountPerHour": 412, "peakSegmentScore": 38 },
                "sensorsUsed": [ { "sensorId": "34", "name": "Flinders St-Elizabeth St (East)", "distanceMetres": 45 }, "..." ],
                "congestionPoints": [ { "name": "Swanston St / Collins St", "latitude": -37.8161, "longitude": 144.9651, "crowdScore": 38 } ]
            },
            "segments": [
                { "segmentId": "route-1-seg-1", "fromLatitude": -37.8136, "fromLongitude": 144.9631, "toLatitude": -37.8149, "toLongitude": 144.9642, "lengthMetres": 360, "hasLiveData": true, "crowdScore": 12, "sensoryRating": "Low", "exceedsThreshold": false }
            ],
            "bypassedAreas": [
                { "name": "Bourke Street Mall", "latitude": -37.8136, "longitude": 144.9648, "crowdScore": 88, "reason": "Pedestrian density above your threshold" }
            ],
            "steps": [
                { "instruction": "Head north on Flinders Street", "distanceMetres": 360, "durationMinutes": 4 },
                { "instruction": "Turn left onto Elizabeth Street", "distanceMetres": 380, "durationMinutes": 5 },
                "..."
            ],
            "alerts": []
        }
    ],
    "refugeSpaces": [ "...same shape as GET /api/refuges/nearby refuges[]..." ],
    "dataUpdatedAt": "2026-08-06T14:45:47.514Z",
    "dataSource": "mock"
}
```

**Uncovered segment** (from `route-3`, which has `sensorCoverage: "partial"`,
`noDataDistanceMetres: 300`) — note **no crowd score** and `Unknown`:
```json
{
  "segmentId": "route-3-seg-4",
  "fromLatitude": -37.8175, "fromLongitude": 144.9663,
  "toLatitude": -37.8183, "toLongitude": 144.9671,
  "lengthMetres": 300,
  "hasLiveData": false,
  "crowdScore": null,
  "sensoryRating": "Unknown",
  "exceedsThreshold": false
}
```

Field notes:
- `route-2` (fastest, 15 min) is the **most crowded** (High, `highCrowdDistanceMetres` 880). `route-1` (calmest, Low) is recommended and is the quieter alternative to the fast route.
- The four distance buckets **sum to `distanceMetres`** for every route.
- `minutesSlowerThanRecommended` is relative to the recommended (calmest) route and **can be negative** (a route that is faster than the recommended one).
- `segments[].exceedsThreshold` is per-segment vs `crowdThreshold`; uncovered segments are always `false` (no score to compare).
- `steps[]` is ordered turn-by-turn walking directions ("Get Navigation"). Each entry is `{ instruction, distanceMetres, durationMinutes }`. Live mode pulls this from Google's Routes API (`routes.legs.steps`); mock mode uses fixed fixture steps. `instruction` can be `null` if Google didn't provide text for a given step — never fabricated.

**No-routes** (start == destination) — `200`, not an error:
```json
{
  "noRoutesAvailable": true,
  "recommendedRouteId": null, "fastestRouteId": null, "quieterAlternativeRouteId": null,
  "alternativeMaxExtraMinutes": 10,
  "noLowSensoryRouteAvailable": false, "notice": null,
  "routes": [],
  "refugeSpaces": [ "..." ],
  "dataUpdatedAt": "...", "dataSource": "mock"
}
```

---

## GET /api/refuges/nearby

`walkingMinutes` optional (default 5, max 30); radius = `walkingMinutes × 80 m/min`.
Sorted by walking time ascending (AC 2.1.1).

**Request:**
`curl "http://localhost:5000/api/refuges/nearby?latitude=-37.8100&longitude=144.9660&walkingMinutes=8"`

**200:**
```json
{
    "origin": { "latitude": -37.81, "longitude": 144.966 },
    "walkingMinutes": 8,
    "radiusMetres": 640,
    "openingHoursKnown": false,
    "count": 2,
    "refuges": [
        {
            "refugeId": "refuge-7831ad42ac3e",
            "name": "State Library Victoria",
            "refugeType": "Library",
            "theme": "Place Of Assembly",
            "subTheme": "Library",
            "latitude": -37.8098,
            "longitude": 144.9652,
            "distanceMetres": 74,
            "walkingMinutes": 1,
            "indoorOutdoor": "indoor",
            "attributes": [ "Indoor" ],
            "openingHoursToday": null,
            "photoUrl": null,
            "accessibleEntrance": null
        }
    ]
}
```

`openingHoursToday`, `photoUrl`, `accessibleEntrance` are **always `null`**
(not in the Landmarks dataset), and `openingHoursKnown` is always `false`.
`attributes` currently only ever contains `"Indoor"` (the only tag we can
justify from the data); `[]` is valid and means "no justifiable attributes".
See README → "Fields we always return null".

**AC 2.1.3 (directions to a refuge):** confirmed — this is served by
`POST /api/routes` with the refuge's `latitude`/`longitude` as `destination`.
It returns the same route shape, including `sensoryRating` and per-segment
shading, exactly like any other route. There is no separate refuge-directions
endpoint.

---

## GET /api/forecast — out of current scope

Kept and working (maps to US2.2, not in the signed-off AC). See README and the
previous contract for its shape. Unchanged by this update except the 30-minute
staleness alignment.

## POST /api/routes/reroute — out of current scope

Kept and working (maps to US1.3, not in the signed-off AC). Returns a full route
object (now including all the new AC fields) as its `alternativeRoute`.

---

## Errors

Envelope: `{ "error": { "code": "...", "message": "...", "details": [ ... ] } }`

| HTTP | code | when |
|------|------|------|
| 400 | `INVALID_REQUEST` | validation failed; `details` lists every problem at once |
| 400 | `MALFORMED_JSON` | body is not valid JSON |
| 404 | `NOT_FOUND` | unknown endpoint |
| 413 | `PAYLOAD_TOO_LARGE` | body over the 10kb limit |
| 502 | `UPSTREAM_UNAVAILABLE` | reserved; not emitted while every upstream degrades to mock |
| 500 | `INTERNAL_ERROR` | anything unexpected; generic message only |

**Out-of-Melbourne 400** (distinguishable per AC 1.1.1):
```json
{
    "error": {
        "code": "INVALID_REQUEST",
        "message": "The request failed validation.",
        "details": [
            "start is outside the Melbourne CBD service area. Please enter a valid Melbourne CBD location."
        ]
    }
}
```
