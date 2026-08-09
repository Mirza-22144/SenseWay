# SenseWay Backend

The backend for **SenseWay**, a web app that recommends the *calmest* walking
route across Melbourne's CBD (not the fastest) for neurodivergent and
sensory-sensitive commuters like our persona, Freddy.

Every external system — Google, Postgres, the Melbourne Open Data pipeline — sits
behind this backend. The frontend only ever talks to us. That is why the Google
key never reaches the browser, why the frontend developer isn't blocked waiting
on integrations, and why all sensory scoring lives in one place.

> **No mock fallback.** Google Maps, the database, and the data pipeline are all
> **required** upstreams — `GOOGLE_MAPS_API_KEY`, `DB_HOST`/`DB_PORT`/`DB_NAME`/
> `DB_USER`/`DB_PASSWORD`, and `PIPELINE_URL` must all be set in `.env` for the
> app to actually work. The one exception is pedestrian/DB data specifically:
> a segment with no live sensor data degrades honestly to "no live data" (grey,
> `Unknown`) rather than failing the request, since that's already a normal,
> expected product state (AC 1.2.1) — everything else throws an honest
> `502 UPSTREAM_UNAVAILABLE` instead of ever serving fabricated data.

---

## Requirements

- **Node.js ≥ 18** (developed and tested on Node 26). Uses the built-in global
  `fetch`, `AbortController`, and the built-in test runner.
- `GOOGLE_MAPS_API_KEY`, DB credentials, and `PIPELINE_URL` must all be set in
  `.env` — see `.env.example`. Without them, the corresponding endpoints return
  `502 UPSTREAM_UNAVAILABLE` rather than running at all.

## Install & run

```bash
cd backend
npm install

# Development (auto-reload)
npm run dev            # http://localhost:5000

# Production-style start
npm start

# Tests (Node's built-in runner; starts the app on port 0)
npm test
```

> **macOS note:** port 5000 is often occupied by the **AirPlay Receiver**
> (responds `403` with an empty body). If `curl localhost:5000/api/health`
> returns nothing, either disable AirPlay Receiver in
> *System Settings → General → AirDrop & Handoff*, or run on another port:
> `PORT=5001 npm run dev`.

---

## Environment variables

Copy `.env.example` to `.env` and fill in what you have. **Nothing is required**
in mock mode; each missing value simply keeps that integration mocked.

| Variable | Purpose | Absent → |
|----------|---------|----------|
| `PORT` | HTTP port | defaults to `5000` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Postgres connection for pedestrian/sensor data | pedestrian counts & forecast use **mock** data |
| `GOOGLE_MAPS_API_KEY` | Google Routes API key (server-side only) | candidate routes are **mock** |
| `PIPELINE_URL` | Base URL of `senseway-data-pipeline` for `/refuge/nearby` | refuges are **mock** |
| `CORS_ORIGINS` | Comma-separated allowed browser origins | defaults to `http://localhost:5173` (Vite dev) |
| `GOOGLE_TIMEOUT_MS`, `PIPELINE_TIMEOUT_MS`, `DB_CONNECTION_TIMEOUT_MS` | upstream timeouts | sensible defaults |

The shipped placeholder values in `.env.example` (`our_password`,
`google_maps_api_key`) are treated as "absent", so copying the file unedited
still runs cleanly in mock mode instead of hanging on a bad connection.

**This backend uses the discrete `DB_*` variables.** The `senseway-data-pipeline`
uses a single `DATABASE_URL` instead — one database, two conventions, two
services. That divergence is intentional; see open questions.

---

## Endpoints

Full request/response examples (copied from the real running server) are in
[`API-CONTRACT.md`](./API-CONTRACT.md). Ready-to-run requests are in
[`requests.http`](./requests.http).

| Method & path | Purpose | User story | In current scope? |
|---------------|---------|-----------|-------------------|
| `GET /api/health` | liveness; never touches DB/Google/pipeline | — | yes |
| `POST /api/routes` | calmest-first routes (≤3) with the fastest + quieter alternative, per-route data states and the four-state segment breakdown | US1.1 / US1.2 | yes |
| `GET /api/refuges/nearby` | quiet spaces within a walking-time radius | US2.1 | yes |
| `POST /api/routes/reroute` | warn about a congestion point ahead and offer a calmer route | US1.3 | **no — see below** |
| `GET /api/forecast` | predicted crowd level in 15-minute intervals | US2.2 | **no — see below** |

> **Scope note.** The signed-off *User stories & acceptance criteria* document
> contains only **US1.1, US1.2 and US2.1**. `POST /api/routes/reroute` (US1.3)
> and `GET /api/forecast` (US2.2) were built ahead of the current iteration.
> They are kept and working, but are **outside the current acceptance-criteria
> scope pending team confirmation** — do not treat them as signed-off.

### Route response: the states the frontend keys off

Every AC exception is a UI message, and the response carries exactly the field
the frontend needs to choose it (full table in `API-CONTRACT.md`). The three
axes:

- **`dataState`** (per route): `"live"` | `"stale"` | `"unavailable"`.
  - `live` — fresh live data.
  - `stale` — data older than **30 minutes** → AC 1.1.2 "Sensory data may be
    outdated" (the rating is still shown; staleness no longer blanks it).
  - `unavailable` — no segment has live data → "Live sensory data unavailable" /
    "Detailed sensory data unavailable for this route".
- **`sensorCoverage`** (per route): `"full"` | `"partial"` | `"none"`.
  - `none` → AC 1.2.1 "Our sensor network does not cover this route."
- **`segments[].sensoryRating`** has **four** states for the AC 1.2.1 legend:
  `Low` (green) / `Moderate` (amber) / `High` (red) / **`Unknown` (neutral
  grey)**. An uncovered segment has `hasLiveData: false` and **no crowd score**
  (`crowdScore: null`) — we never score a segment with no sensor coverage.

`dataState`/`dataSource` are different axes: in mock mode the fixtures present as
fresh (`dataState:"live"`) so the frontend can build the happy path, while
`dataSource` stays `"mock"`.

### The quieter alternative (AC 1.2.3)

`quieterAlternativeRouteId` names the calmest route that is within
**`alternativeMaxExtraMinutes`** (default **10**, exposed in the response) of the
fastest route and reduces high-crowd walking distance. It is `null` — the
frontend's cue for "No suitable quieter alternative available" — when nothing
qualifies or when the recommended route's `dataState` is `"unavailable"`.
Per route: `minutesSlowerThanRecommended` (can be negative) and
`highCrowdDistanceSavedMetres`.

### Error format

Every failure (including 404) returns:
```json
{ "error": { "code": "...", "message": "...", "details": [ ... ] } }
```

| HTTP | code | when |
|------|------|------|
| 400 | `INVALID_REQUEST` | validation failed; `details` lists **every** problem at once |
| 400 | `MALFORMED_JSON` | body is not valid JSON |
| 404 | `NOT_FOUND` | unknown endpoint |
| 413 | `PAYLOAD_TOO_LARGE` | body over the 10kb limit |
| 502 | `UPSTREAM_UNAVAILABLE` | Google (routes) or the pipeline (refuges) is unconfigured or the call failed — see API-CONTRACT.md |
| 500 | `INTERNAL_ERROR` | anything unexpected; generic message only |

> **About 502:** Google and the pipeline are required upstreams with no mock
> fallback, so a missing credential or a failed call throws `UPSTREAM_UNAVAILABLE`
> immediately. Pedestrian/DB data is the exception — it degrades a segment to
> "no live data" instead, since partial/no sensor coverage is already a normal
> product state, not an error.

---

## Folder structure

```
backend/
  server.js                       # entry point (unchanged): loads .env, listens
  src/
    app.js                        # Express app: security, routers, error handling
    config/
      env.js                      # reads & validates process.env ONCE (frozen)
      database.js                 # lazy pg Pool; null when DB unconfigured
    middleware/
      errorHandler.js             # ApiError + the single JSON error envelope
      notFound.js                 # JSON 404 (Express-5-safe, no app.get("*"))
      validationHelpers.js        # shared coordinate/number/time validators
      validateRouteRequest.js
      validateRerouteRequest.js
      validateRefugeQuery.js
      validateForecastQuery.js
    routes/                       # thin routers, one per feature
    controllers/                  # request in, response out; no business logic
    services/
      scoring.service.js          # PURE crowd-score -> Low/Moderate/High/Unknown
      routeMetrics.js             # PURE per-route AC helpers (buckets, dataState,
                                  #   sensorCoverage, ratingReason, quieter alt)
      route.service.js            # calmest-first orchestration
      reroute.service.js          # (US1.3 - outside current AC scope)
      refuge.service.js           # calls the pipeline over HTTP; no mock fallback
      forecast.service.js         # (US2.2 - outside current AC scope)
      google.service.js           # Google Routes API; no mock fallback
      pedestrian.service.js       # live counts; degrades to "no live data", never mock
    repositories/
      pedestrian.repository.js    # ALL SQL lives here; parameterised only
    utils/                        # geo, ids, polyline, crowd scaling, time
  tests/                          # Node built-in test runner
  API-CONTRACT.md
  requests.http
```

**Layering:** `route → middleware → controller → service → repository / external
API`. Each layer only talks to the next one down.

---

## Live integrations

No mock fallback remains anywhere in this backend. Same function signature
regardless of outcome, so the response shape never changes.

| Integration | Behaviour | Requires |
|-------------|-----------|-----------|
| Candidate routes | Real Google Routes API call, alternatives, decoded polyline, per-segment scoring. Unconfigured or a failed call throws `502 UPSTREAM_UNAVAILABLE`. | `GOOGLE_MAPS_API_KEY` |
| Pedestrian counts / nearest sensor | Real parameterised SQL against `SENSOR_LOCATION`, `PEDESTRIAN_HOUR_COUNT`, `PEDESTRIAN_MINUTE_COUNT`. Unconfigured or a failed query degrades that segment to "no live data" (`Unknown`, grey) rather than erroring the whole route - a segment without sensor coverage is already a normal, expected state. | `DB_*` |
| Refuge spaces | Real HTTP call to the pipeline's `/refuge/nearby` (one retry on transient failure). Unconfigured or a failed call throws `502 UPSTREAM_UNAVAILABLE`. | `PIPELINE_URL` |

`dataSource` in the `/api/routes` response reports which happened: `"live"`
(at least one segment got a real score) or `"partial"` (live geometry, but no
segment had sensor coverage - honest, not an error).

---

## The five schema traps (and how the code handles them)

The pipeline's ingestion scripts are the source of truth for the DB. All SQL is
in `src/repositories/pedestrian.repository.js`. Five real traps:

1. **`Longtitude` is misspelled** in `SENSOR_LOCATION` and `LANDMARK`. We spell
   it wrong in SQL to match the column and alias it to a correct `longitude` in
   the result — exactly as the pipeline's `refugeFinder.js` does.
2. **`Total_of_Direction` is singular** (the open-data API field
   `total_of_directions` was plural). We use the DB spelling.
3. **Postgres folds unquoted identifiers to lowercase.** We alias **every**
   selected column explicitly with `AS snake_case`, so JS row keys don't depend
   on remembering the folding rule.
4. **`LANDMARK` has no unique constraint** and `landmarks.js` inserts with no
   `ON CONFLICT`, so re-running ingestion duplicates rows. We derive a stable
   `refugeId` from `name + coordinates` and don't assume rows are unique.
5. **`PEDESTRIAN_HOUR_COUNT` is a thin recent slice** (`rows=1000` from the
   monthly-counts dataset), not the full 2009-present history the presentation
   implies. The forecast returns **`Unknown` / low confidence** for buckets with
   too few or zero rows rather than a fabricated number (see below).

---

## Forecast method and limitations

**Method (deliberately simple, US2.2):** the predicted crowd level for a
`(sensor, day-of-week, hour)` is the **mean of matching historical rows** from
`PEDESTRIAN_HOUR_COUNT.Total_of_Direction`. That mean count is scaled to a 0–100
crowd score against a fixed reference (`PEAK_REFERENCE_COUNT = 1800`) and mapped
to Low/Moderate/High. 15-minute intervals repeat the hour's mean across its
quarters. No ML, no trend fitting — it's the simplest thing we can defend.

**Limitations (be honest about these):**
- **Thin data (trap 5):** many buckets have few or zero rows. Those return
  `crowdScore: null`, `sensoryRating: "Unknown"`, `confidence: "low"`. We do not
  invent numbers. Confidence is `"high"` only with ≥ 10 rows.
- **The count→score scaling is a rough calibration**, not a statistically
  derived threshold. `PEAK_REFERENCE_COUNT` should be tuned per sensor once we
  have more data.
- **Hour/day bucketing is pinned to Melbourne** (`Australia/Melbourne`, DST-aware
  via `Intl`, constant `MELBOURNE_TZ` in `src/utils/time.js`), because the
  pedestrian data is recorded in Melbourne local time and Cloud Run runs in UTC.
  A `TZ=UTC` test guards against any regression to server-local time.
- **Every 15 minutes within an hour share that hour's mean**, so intra-hour
  changes are flat. Fine for a departure-time slider at this fidelity.

---

## Security notes (why, not what)

I own the security workstream; each of these is deliberate:

- **Server-side validation even though React validates.** React validation is a
  convenience for the user, not a control — anyone can hit these endpoints with
  curl and never load the frontend. The server is the only enforceable place.
- **Melbourne bounding box.** Coordinates are the only caller-controlled lever
  that costs money (each route call can be a paid Google request). Rejecting
  points outside greater Melbourne stops bill-running with arbitrary worldwide
  coordinates, and matches our data coverage.
- **All validation problems collected at once** into `details`, and a **clean
  object of only known fields** is rebuilt and attached to the request — nothing
  unexpected the client sent travels deeper into the system.
- **The Google key is read only by this backend** (from env) and never appears
  in any response.
- **CORS is an explicit allow-list** from `CORS_ORIGINS`, never `*`. A bare `*`
  would let any website call this API from a visitor's browser.
- **10kb JSON body limit** — a route request is tiny; larger is a mistake or an
  attempt to exhaust memory.
- **500s log the real error server-side and return a generic message** — never a
  stack trace or a Postgres error string to the browser.
- **Every SQL query is parameterised** (`$1, $2, …`); no string concatenation.
- **`x-powered-by` disabled.**
- **No personal data stored.** Coordinates answer the request and are not
  persisted. `congestionPointId` is derived deterministically from coordinates
  rather than stored, so dismissed-prompt memory lives in the (accountless)
  frontend.
- **"Unknown" beats a guessed rating.** A segment with no live sensor coverage
  is `Unknown` (never scored), because presenting invented crowd data as current
  is worse than saying nothing for a user choosing a route to avoid a sensory
  ambush. (Per AC 1.1.2, data that is merely *stale* — older than **30 minutes**
  — keeps its rating but is flagged via `dataState: "stale"`; staleness no longer
  blanks the rating to `Unknown`.)

---

## Refuge type mapping (AC 2.1.1 / 2.1.2)

`refugeType` is derived from the Landmark `theme` + `sub_theme` (matched
case-insensitively, first match wins):

| Matches (in theme/sub_theme) | `refugeType` | `indoorOutdoor` | `attributes` |
|------------------------------|--------------|-----------------|--------------|
| `library` | Library | indoor | `["Indoor"]` |
| `garden`, `park`, `reserve` | Park | outdoor | `[]` |
| `cafe`, `coffee` | Quiet cafe | indoor | `["Indoor"]` |
| `gallery`, `museum` | Gallery or museum | indoor | `["Indoor"]` |
| `worship`, `cathedral`, `church`, `chapel`, `temple`, `mosque`, `synagogue` | Place of worship | indoor | `["Indoor"]` |
| `hall` | Community hall | indoor | `["Indoor"]` |
| `theatre` | Theatre | indoor | `["Indoor"]` |
| anything else | Public space | null | `[]` |

`attributes` only ever contains `"Indoor"` today, because that is the **only**
tag defensible from the dataset. AC 2.1.2's other example tags — `Seated`,
`Quiet`, `Low-light` — are **not** in the Landmarks data, so we never claim them;
`[]` is the honest answer (which AC 2.1.2's "attributes unavailable" exception
anticipates).

---

## Fields we always return null (source data does not contain them)

The acceptance criteria were written as if some data exists that our sources do
not actually provide. These fields are therefore **always `null`** (or an empty
set), never invented. This needs to be visible, not buried:

| Field | Endpoint | Dataset that lacks it | AC that assumes it |
|-------|----------|-----------------------|--------------------|
| `openingHoursToday` | refuges | City of Melbourne **Landmarks** (no opening hours) | 2.1.2 opening hours, 2.1.3 "Closed now" |
| `openingHoursKnown` (always `false`) | refuges | Landmarks | 2.1.2 |
| `photoUrl` | refuges | Landmarks (no photos) | 2.1.2 photo / default icon |
| `accessibleEntrance` | refuges | Landmarks (no accessibility/entrance data) | 2.1.3 "pin at the accessible entrance" |
| `attributes` beyond `Indoor` | refuges | Landmarks (no seating/noise/lighting) | 2.1.2 Seated / Quiet / Low-light |
| `indoorOutdoor` when the theme is ambiguous | refuges | Landmarks (inferred from theme only) | 2.1.2 closed-venue rule |

**Consequence for AC 2.1.2 / 2.1.3 open-vs-closed logic:** because there are no
opening hours, the backend **cannot** determine whether a refuge is open or
closed. It exposes `indoorOutdoor` so the frontend *could* apply the
"outdoor spaces still allow directions, indoor venues disabled when closed" rule
*if* an opening-hours source is added later — but today "Closed now" cannot be
produced. Flagged in open questions.

---

## Required configuration

All of the below are now connected and required for this app to function —
none have a mock fallback (pedestrian/DB data is the one exception: it
degrades honestly per-segment instead of failing). All are **config changes**
in `.env`, never code changes.

| Need | Env variable | What the backend does **without** it |
|------|--------------|--------------------------------------|
| **Google Maps API key** (with Routes API enabled) | `GOOGLE_MAPS_API_KEY` | `POST /api/routes` (and reroute) throw `502 UPSTREAM_UNAVAILABLE` |
| **Database read credentials** | `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` | segments degrade to "no live data" (`Unknown`, grey) instead of a crowd score; forecast returns no sensor |
| **Pipeline Cloud Run URL** | `PIPELINE_URL` | `GET /api/refuges/nearby` throws `502 UPSTREAM_UNAVAILABLE` |
| **Deployed frontend origin** (Firebase Hosting URL) | `CORS_ORIGINS` | only `http://localhost:5173` is allowed |

Also awaiting non-config answers:
- **Frontend owner** to sign off the response shapes in `API-CONTRACT.md`.
- A decision on the **`user_preferences` table** (see open questions).

---

## Open questions for the team

1. **`user_preferences` vs "accountless".** `database/schema.sql` defines a
   `user_preferences` table with a `user_id`, and slide 28 says preferences are
   stored in the DB — but our security position is an accountless MVP with no
   personal data. **This backend does not read or write that table.** Which is
   it? This changes the Security Plan; please confirm scope.
2. **DB config convention.** This backend uses `DB_*`; the pipeline uses
   `DATABASE_URL`. Standardise, or accept the divergence? (Recommendation:
   accept it — they're separate services.)
3. **Landmark duplicates (trap 4).** `landmarks.js` inserts into `LANDMARK` with
   no `ON CONFLICT` and the table has no unique key, so re-running
   `/ingest/landmarks` duplicates every row. Can the pipeline add a unique
   constraint / `ON CONFLICT`? (Not ours to fix; we dedupe defensively.)
4. **Pipeline deploy security.** `senseway-data-pipeline/README.md` publishes the
   Cloud SQL public IP (`34.60.6.97:5432`) and a
   `gcloud run deploy --allow-unauthenticated` command in our public repo —
   i.e. a public, unauthenticated endpoint that writes to our database. (The
   password shown is the placeholder `PASSWORD`, not a real secret.) Can we drop
   the IP from the README and put auth on the deployed endpoint?
5. **Forecast time zone — resolved, one assumption to confirm.** Hour/day
   bucketing is now pinned to `Australia/Melbourne` (DST-aware). This assumes the
   pipeline stores `Sensing_Date`/`HourDay` as **Melbourne local** values (which
   matches how City of Melbourne publishes the data). Please confirm the pipeline
   doesn't convert to UTC on ingest.
6. **Opening hours / open-closed (AC 2.1.2 & 2.1.3).** The AC assumes we can show
   "Open until 5:00 PM" / "Closed now" and disable directions for a closed indoor
   venue. The **Landmarks dataset has no opening hours**, so the backend cannot
   determine open/closed at all (`openingHoursToday` and `openingHoursKnown` are
   always null/false). Do we (a) add an opening-hours data source, (b) drop the
   open/closed behaviour for this iteration, or (c) accept "hours unavailable"
   everywhere? This is a scope decision, not something code can solve.
7. **Photos & accessible entrance (AC 2.1.2 & 2.1.3).** Same problem: the source
   has no `photoUrl` and no accessible-entrance coordinates, so both are always
   null. Confirm these ACs are deferred or point us at a data source.
8. **Reroute & forecast scope (US1.3 / US2.2).** These endpoints exist and work
   but are **not** in the signed-off AC document. Keep, hide, or schedule?
