# SenseWay Backend — API Contract

Version: onboarding iteration. Base URL in development: `http://localhost:5000`.

Every response, success or failure, is JSON. Every example below was **copied
from the real running server** (mock mode, no credentials), not hand-written, so
what you see is exactly what you get. Timestamps will differ per request.

> Frontend owner: please review the response shapes and confirm before we treat
> them as frozen. Anything you need renamed/added is cheap to change now.

---

## Conventions

- Sensory vocabulary is exactly **`Low` / `Moderate` / `High` / `Unknown`**
  (never "Medium"). `Unknown` means we did not have data we could trust.
- Crowd scores are integers `0–100`. Bands: `0–30` Low, `31–70` Moderate,
  `71–100` High.
- `dataSource` is one of `"mock"`, `"live"`, `"partial"` — where the data behind
  this response came from. In mock mode (no credentials) it is `"mock"`.
- Coordinates must be inside greater Melbourne, otherwise the request is
  rejected 400 (see Errors).

---

## GET /api/health

Liveness only. Never touches the database, Google, or the pipeline.

**Request:** `curl http://localhost:5000/api/health`

**200:**
```json
{
    "status": "ok",
    "service": "senseway-backend",
    "timestamp": "2026-08-06T10:09:20.240Z"
}
```

---

## GET /

Unchanged legacy welcome route.

**200 (text/html):**
```
Welcome to SenseWay Backend
```

---

## POST /api/routes

Recommend the calmest walking route, with the fastest one identified and the
trade-off made explicit. `routes` is sorted **calmest first**, duration as the
tie-break.

**Request body** (`departureTime` and `preferences` optional; defaults
`departureTime = now`, `avoidHighDensity = true`, `crowdThreshold = 70`):
```json
{
  "start":       { "latitude": -37.8136, "longitude": 144.9631 },
  "destination": { "latitude": -37.8183, "longitude": 144.9671 },
  "departureTime": "2026-08-06T08:15:00+10:00",
  "preferences": { "avoidHighDensity": true, "crowdThreshold": 70 }
}
```

**200** (abridged to two of the three routes for readability — the real response
contains all three; every field shown is real):
```json
{
    "query": {
        "start": { "latitude": -37.8136, "longitude": 144.9631 },
        "destination": { "latitude": -37.8183, "longitude": 144.9671 },
        "departureTime": "2026-08-05T22:15:00.000Z",
        "preferences": { "avoidHighDensity": true, "crowdThreshold": 70 }
    },
    "recommendedRouteId": "route-1",
    "fastestRouteId": "route-2",
    "noLowSensoryRouteAvailable": false,
    "notice": null,
    "routes": [
        {
            "routeId": "route-1",
            "summary": "Via Little Collins Street",
            "durationMinutes": 19,
            "distanceMetres": 1420,
            "minutesSlowerThanFastest": 4,
            "polyline": "mock~littlecollins~b1n3",
            "crowdScore": 24,
            "sensoryRating": "Low",
            "confidence": "high",
            "dataUpdatedAt": "2026-08-06T10:09:20.287Z",
            "contributingFactors": {
                "pedestrianDensity": { "averageCountPerHour": 412, "peakSegmentScore": 38 },
                "sensorsUsed": [
                    { "sensorId": "34", "name": "Flinders St-Elizabeth St (East)", "distanceMetres": 45 },
                    { "sensorId": "22", "name": "Little Collins St-Swanston St (West)", "distanceMetres": 60 },
                    { "sensorId": "18", "name": "Collins Place (South)", "distanceMetres": 80 }
                ],
                "congestionPoints": [
                    { "name": "Swanston St / Collins St", "latitude": -37.8161, "longitude": 144.9651, "crowdScore": 38 }
                ]
            },
            "segments": [
                { "segmentId": "route-1-seg-1", "fromLatitude": -37.8136, "fromLongitude": 144.9631, "toLatitude": -37.8149, "toLongitude": 144.9642, "crowdScore": 12, "sensoryRating": "Low", "exceedsThreshold": false },
                { "segmentId": "route-1-seg-2", "fromLatitude": -37.8149, "fromLongitude": 144.9642, "toLatitude": -37.8161, "toLongitude": 144.9651, "crowdScore": 20, "sensoryRating": "Low", "exceedsThreshold": false },
                { "segmentId": "route-1-seg-3", "fromLatitude": -37.8161, "fromLongitude": 144.9651, "toLatitude": -37.8172, "toLongitude": 144.9662, "crowdScore": 38, "sensoryRating": "Moderate", "exceedsThreshold": false },
                { "segmentId": "route-1-seg-4", "fromLatitude": -37.8172, "fromLongitude": 144.9662, "toLatitude": -37.8183, "toLongitude": 144.9671, "crowdScore": 26, "sensoryRating": "Low", "exceedsThreshold": false }
            ],
            "bypassedAreas": [
                { "name": "Bourke Street Mall", "latitude": -37.8136, "longitude": 144.9648, "crowdScore": 88, "reason": "Pedestrian density above your threshold" },
                { "name": "Flinders St Station underpass", "latitude": -37.8183, "longitude": 144.9671, "crowdScore": 81, "reason": "Pedestrian density above your threshold" }
            ],
            "alerts": []
        },
        {
            "routeId": "route-2",
            "summary": "Via Bourke Street Mall",
            "durationMinutes": 15,
            "distanceMetres": 1180,
            "minutesSlowerThanFastest": 0,
            "polyline": "mock~bourkemall~f4st",
            "crowdScore": 79,
            "sensoryRating": "High",
            "confidence": "high",
            "dataUpdatedAt": "2026-08-06T10:09:20.287Z",
            "contributingFactors": {
                "pedestrianDensity": { "averageCountPerHour": 1750, "peakSegmentScore": 90 },
                "sensorsUsed": [
                    { "sensorId": "2", "name": "Bourke Street Mall (North)", "distanceMetres": 25 },
                    { "sensorId": "3", "name": "Bourke Street Mall (South)", "distanceMetres": 30 },
                    { "sensorId": "5", "name": "Melbourne Central", "distanceMetres": 55 }
                ],
                "congestionPoints": [
                    { "name": "Bourke Street Mall", "latitude": -37.8144, "longitude": 144.9648, "crowdScore": 88 },
                    { "name": "Bourke St / Swanston St", "latitude": -37.8152, "longitude": 144.9659, "crowdScore": 90 }
                ]
            },
            "segments": [
                { "segmentId": "route-2-seg-1", "fromLatitude": -37.8136, "fromLongitude": 144.9631, "toLatitude": -37.8144, "toLongitude": 144.9648, "crowdScore": 70, "sensoryRating": "Moderate", "exceedsThreshold": false },
                { "segmentId": "route-2-seg-2", "fromLatitude": -37.8144, "fromLongitude": 144.9648, "toLatitude": -37.8152, "toLongitude": 144.9659, "crowdScore": 85, "sensoryRating": "High", "exceedsThreshold": true },
                { "segmentId": "route-2-seg-3", "fromLatitude": -37.8152, "fromLongitude": 144.9659, "toLatitude": -37.8168, "toLongitude": 144.9665, "crowdScore": 90, "sensoryRating": "High", "exceedsThreshold": true },
                { "segmentId": "route-2-seg-4", "fromLatitude": -37.8168, "fromLongitude": 144.9665, "toLatitude": -37.8183, "toLongitude": 144.9671, "crowdScore": 72, "sensoryRating": "High", "exceedsThreshold": true }
            ],
            "bypassedAreas": [],
            "alerts": []
        }
    ],
    "refugeSpaces": [
        {
            "refugeId": "refuge-161e3e89cba2",
            "name": "Melbourne Town Hall",
            "theme": "Place Of Assembly",
            "subTheme": "Hall",
            "latitude": -37.8148,
            "longitude": 144.9669,
            "distanceMetres": 359,
            "walkingMinutes": 4,
            "indoorOutdoor": "indoor",
            "openNow": null,
            "seatingAvailable": null,
            "noiseLevel": null
        }
    ],
    "dataUpdatedAt": "2026-08-06T10:09:20.287Z",
    "dataSource": "mock"
}
```

Notes for the frontend:
- `route-2` (fastest, 15 min) is the **most crowded** (High). `route-1` (calmest,
  Low) is recommended even though it is 4 minutes slower — that's the product.
- `segment.exceedsThreshold` is per-segment against the caller's
  `crowdThreshold`. Note `crowdScore: 70` with threshold 70 is **not** exceeding
  (strict `>`).
- Set `crowdThreshold` low (e.g. 10) to see `noLowSensoryRouteAvailable: true`
  and a non-null `notice`.

---

## POST /api/routes/reroute

Given the user's live position, decide whether to warn about a congestion point
ahead and offer a calmer route.

**Request:**
```json
{
  "currentLocation": { "latitude": -37.8136, "longitude": 144.9631 },
  "destination":     { "latitude": -37.8183, "longitude": 144.9671 },
  "activeRouteId": "route-2",
  "preferences": { "crowdThreshold": 70 }
}
```

**200 — reroute recommended** (`alternativeRoute` is a full route object,
abridged here; `congestionPointId` is stable for the same point across
requests):
```json
{
    "rerouteRecommended": true,
    "congestionPointId": "cp-c92b0533ff78",
    "congestionPoint": {
        "name": "Bourke Street Mall",
        "latitude": -37.8144,
        "longitude": 144.9648,
        "crowdScore": 88
    },
    "metresAhead": 174,
    "reason": "Bourke Street Mall ahead is above your crowd threshold.",
    "alternativeRoute": { "routeId": "route-1", "summary": "Via Little Collins Street", "crowdScore": 24, "sensoryRating": "Low", "...": "full route object, same shape as POST /api/routes routes[]" }
}
```

**200 — no reroute** (e.g. the user is already past all congestion points):
```json
{
    "rerouteRecommended": false,
    "reason": "No congestion ahead above your threshold."
}
```

`congestionPointId` is derived deterministically from the point's coordinates.
The backend does not store dismissals (the MVP is accountless); the frontend
should remember which ids the user dismissed and stop re-showing them.

---

## GET /api/refuges/nearby

Quiet spaces within a walking-time radius. `walkingMinutes` optional (default 5,
max 30); radius = `walkingMinutes × 80 m/min`.

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
            "theme": "Place Of Assembly",
            "subTheme": "Library",
            "latitude": -37.8098,
            "longitude": 144.9652,
            "distanceMetres": 74,
            "walkingMinutes": 1,
            "indoorOutdoor": "indoor",
            "openNow": null,
            "seatingAvailable": null,
            "noiseLevel": null
        },
        {
            "refugeId": "refuge-161e3e89cba2",
            "name": "Melbourne Town Hall",
            "theme": "Place Of Assembly",
            "subTheme": "Hall",
            "latitude": -37.8148,
            "longitude": 144.9669,
            "distanceMetres": 540,
            "walkingMinutes": 7,
            "indoorOutdoor": "indoor",
            "openNow": null,
            "seatingAvailable": null,
            "noiseLevel": null
        }
    ]
}
```

`openNow`, `seatingAvailable`, `noiseLevel` are **always `null`** and
`openingHoursKnown` is **always `false`** — the landmark open data contains none
of these. `indoorOutdoor` is derived from theme only where the theme genuinely
implies it (a garden is `"outdoor"`, a library/hall/cathedral is `"indoor"`),
otherwise `null`.

---

## GET /api/forecast

Predicted crowd level in 15-minute intervals, to drive a departure-time slider.

**Request:**
`curl "http://localhost:5000/api/forecast?latitude=-37.8136&longitude=144.9631&departureTime=2026-08-06T08:15:00%2B10:00&hours=2"`

**200** (intervals abridged; 8 intervals for `hours=2`):
```json
{
    "location": { "latitude": -37.8136, "longitude": 144.9631 },
    "nearestSensor": { "sensorId": "6", "name": "Swanston St / Flinders St (mock)", "distanceMetres": 516 },
    "method": "historical mean for this sensor, day-of-week and hour",
    "sampleSize": 20,
    "requestedDepartureTime": "2026-08-05T22:15:00.000Z",
    "intervals": [
        { "startTime": "2026-08-05T22:15:00.000Z", "crowdScore": 78, "sensoryRating": "High", "percentChangeVsRequested": 0, "confidence": "high" },
        { "startTime": "2026-08-05T23:00:00.000Z", "crowdScore": 61, "sensoryRating": "Moderate", "percentChangeVsRequested": -22, "confidence": "high" },
        { "startTime": "2026-08-06T00:00:00.000Z", "crowdScore": 44, "sensoryRating": "Moderate", "percentChangeVsRequested": -44, "confidence": "high" }
    ],
    "calmestInterval": { "startTime": "2026-08-06T00:00:00.000Z", "crowdScore": 44, "sensoryRating": "Moderate" }
}
```

- `percentChangeVsRequested` compares each interval to the requested departure
  slot (interval 0, always `0`). Here density falls 44% about 1h45 later — this
  is the "leaving X earlier/later changes density by Y%" story.
- When a `(sensor, day-of-week, hour)` bucket has too few historical rows,
  `crowdScore` is `null`, `sensoryRating` is `"Unknown"`, `confidence` is
  `"low"`. We never fabricate a number (see README, forecast limitations).

---

## Errors

Every failure uses the same envelope:
```json
{ "error": { "code": "...", "message": "...", "details": [ ... ] } }
```

| HTTP | code | when |
|------|------|------|
| 400 | `INVALID_REQUEST` | validation failed; `details` lists **every** problem at once |
| 400 | `MALFORMED_JSON` | request body is not valid JSON |
| 404 | `NOT_FOUND` | unknown endpoint |
| 413 | `PAYLOAD_TOO_LARGE` | body exceeded the 10kb limit |
| 502 | `UPSTREAM_UNAVAILABLE` | reserved; not emitted while every upstream degrades to mock (see README) |
| 500 | `INTERNAL_ERROR` | anything unexpected; generic message only, never a stack trace |

**400 example** (missing destination):
```json
{
    "error": {
        "code": "INVALID_REQUEST",
        "message": "The request failed validation.",
        "details": [
            "destination is required and must be an object with latitude and longitude."
        ]
    }
}
```

**404 example:**
```json
{
    "error": {
        "code": "NOT_FOUND",
        "message": "No endpoint matches GET /api/nope.",
        "details": []
    }
}
```

**MALFORMED_JSON example:**
```json
{
    "error": {
        "code": "MALFORMED_JSON",
        "message": "Request body is not valid JSON.",
        "details": []
    }
}
```
