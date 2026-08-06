# SenseWay Data Pipeline

Ingestion scripts that pull City of Melbourne open data into the `senseway`
PostgreSQL database (Cloud SQL) and expose them as HTTP endpoints Cloud Run
and Cloud Scheduler can trigger.

## Running it locally (any teammate)

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in the real `DATABASE_URL`
   (ask the team for the Cloud SQL password - never commit this file).
3. Start the server:
   ```
   node src/server.js
   ```
4. Trigger the sensor locations ingestion by visiting, in a browser or via curl:
   ```
   http://localhost:8080/ingest/sensor-locations
   ```
5. Check the result in DBeaver: `SELECT * FROM SENSOR_LOCATION;`

## Deploying to Cloud Run

From this folder, with the Google Cloud CLI installed and authenticated:
```
gcloud run deploy senseway-data-pipeline \
  --source . \
  --region australia-southeast1 \
  --set-env-vars DATABASE_URL="postgresql://postgres:PASSWORD@34.60.6.97:5432/senseway" \
  --allow-unauthenticated
```

This builds the Dockerfile automatically and gives you a public URL. Once
deployed, that URL's `/ingest/sensor-locations` endpoint is what Cloud
Scheduler calls on a recurring schedule instead of running it manually.

## Project structure

```
src/
  db.js                     - shared PostgreSQL connection pool
  server.js                 - Express app, exposes ingestion endpoints
  ingest/
    sensorLocations.js      - Sensor Locations dataset (run this first)
    (hourCounts.js, minuteCounts.js, landmarks.js - to be added)
```

## Order matters

Ingest in this order, since later tables have foreign keys to earlier ones:
1. Sensor Locations (this script)
2. Hourly pedestrian counts
3. Minute-level pedestrian counts
4. Landmark Category
5. Landmark
