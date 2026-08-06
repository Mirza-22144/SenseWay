# SenseWay Backend

The backend for **SenseWay**, a web app that recommends the *calmest* walking
route across Melbourne's CBD (not the fastest) for neurodivergent and
sensory-sensitive commuters like our persona, Freddy.

Every external system — Google, Postgres, the Melbourne Open Data pipeline — sits
behind this backend. The frontend only ever talks to us. That is why the Google
key never reaches the browser, why the frontend developer isn't blocked waiting
on integrations, and why all sensory scoring lives in one place.

> **This is mock-first.** With **no credentials at all**, every endpoint returns
> realistic Melbourne CBD data so the frontend can be built today. When the team
> supplies a Google key / DB credentials / the pipeline URL, each integration
> switches to live behind an env check — a **config change, not a code change**.

---

## Requirements

- **Node.js ≥ 18** (developed and tested on Node 26). Uses the built-in global
  `fetch`, `AbortController`, and the built-in test runner.
- No database or API keys required to run in mock mode.

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

| Method & path | Purpose | User story |
|---------------|---------|-----------|
| `GET /api/health` | liveness; never touches DB/Google/pipeline | — |
| `POST /api/routes` | calmest-first candidate routes with the fastest identified and factors explained | US1.1 / US1.2 |
| `POST /api/routes/reroute` | warn about a congestion point ahead and offer a calmer route | US1.3 |
| `GET /api/refuges/nearby` | quiet spaces within a walking-time radius | US2.1 |
| `GET /api/forecast` | predicted crowd level in 15-minute intervals | US2.2 |

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
| 502 | `UPSTREAM_UNAVAILABLE` | reserved — see note below |
| 500 | `INTERNAL_ERROR` | anything unexpected; generic message only |

> **About 502:** every upstream currently *degrades to mock* on failure rather
> than failing the request, so `UPSTREAM_UNAVAILABLE` is defined but not emitted
> in this iteration. It becomes live once we disable mock fallback for
> production (a single policy switch), so the frontend can code for it now.

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
      route.service.js            # calmest-first orchestration
      reroute.service.js
      refuge.service.js           # calls the pipeline over HTTP (mock fallback)
      forecast.service.js
      google.service.js           # Google Routes API (mock fallback)
      pedestrian.service.js       # live counts (mock fallback)
    repositories/
      pedestrian.repository.js    # ALL SQL lives here; parameterised only
    data/                         # realistic Melbourne CBD mock fixtures
    utils/                        # geo, ids, polyline, crowd scaling, time
  tests/                          # Node built-in test runner
  API-CONTRACT.md
  requests.http
```

**Layering:** `route → middleware → controller → service → repository / external
API`. Each layer only talks to the next one down.

---

## Mock vs live

Same function signature on both paths, so the response shape never changes.

| Integration | Mock path (today) | Live path (written, waiting on) | To go live, set |
|-------------|-------------------|----------------------------------|-----------------|
| Candidate routes | rich mock routes in `data/mockRoutes.js` | real Google Routes API call, alternatives, decoded polyline, per-segment scoring | `GOOGLE_MAPS_API_KEY` |
| Pedestrian counts / nearest sensor | mock hourly curve + mock sensor | real parameterised SQL against `SENSOR_LOCATION`, `PEDESTRIAN_HOUR_COUNT`, `PEDESTRIAN_MINUTE_COUNT` | `DB_*` |
| Refuge spaces | mock landmarks filtered by radius | real HTTP call to the pipeline's `/refuge/nearby` | `PIPELINE_URL` |

`dataSource` in the response reports which happened: `"mock"`, `"live"`, or
`"partial"` (e.g. live Google geometry scored with mock pedestrian data).

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
- **Hour bucketing uses the server's local time zone.** For correctness this
  should be pinned to Melbourne (Australia/Melbourne) regardless of where the
  server runs — a known follow-up.
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
- **"Unknown" beats a guessed rating.** Data missing or older than 60 minutes
  returns `Unknown`, because presenting stale crowd data as current is worse
  than saying nothing for a user choosing a route to avoid a sensory ambush.

---

## Blocked on the team

None of these block the mock-first build — the frontend can proceed today — but
each is needed to switch an integration to live. All are **config changes**.

| Need | Env variable | What the backend does **without** it | What changes **the moment it arrives** |
|------|--------------|--------------------------------------|----------------------------------------|
| **Google Maps API key** (with Routes API enabled) | `GOOGLE_MAPS_API_KEY` | serves mock candidate routes, `dataSource:"mock"` | real Google Routes call runs; geometry becomes live |
| **Database read credentials** | `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` | pedestrian counts & forecast use the mock curve | real parameterised SQL runs against the real tables |
| **Pipeline Cloud Run URL** | `PIPELINE_URL` | refuges come from mock landmarks | real `/refuge/nearby` HTTP call runs |
| **Deployed frontend origin** (Firebase Hosting URL) | `CORS_ORIGINS` | only `http://localhost:5173` is allowed | deployed frontend can call the API from the browser |

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
5. **Forecast time zone.** Pin hour bucketing to Australia/Melbourne? (See
   forecast limitations.)
