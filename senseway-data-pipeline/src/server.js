require('dotenv').config();
const express = require('express');
const { ingestSensorLocations } = require('./ingest/sensorLocations');
const { ingestHourCounts } = require('./ingest/hourCounts');
const { ingestMinuteCounts } = require('./ingest/minuteCounts');
const { ingestLandmarks } = require('./ingest/landmarks');
const { findNearbyRefuges } = require('./refuge/refugeFinder');

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'senseway-data-pipeline' });
});

app.get('/ingest/sensor-locations', async (req, res) => {
  try {
    res.json({ success: true, ...(await ingestSensorLocations()) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/ingest/hour-counts', async (req, res) => {
  try {
    res.json({ success: true, ...(await ingestHourCounts()) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/ingest/minute-counts', async (req, res) => {
  try {
    res.json({ success: true, ...(await ingestMinuteCounts()) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/ingest/landmarks', async (req, res) => {
  try {
    res.json({ success: true, ...(await ingestLandmarks()) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Refuge Space Finder - takes a location and returns nearby quiet spaces.
// Example: /refuge/nearby?lat=-37.8136&lon=144.9631&radius=300
app.get('/refuge/nearby', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const radius = req.query.radius ? parseFloat(req.query.radius) : 300;

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ success: false, error: 'lat and lon query params are required and must be numbers' });
    }

    const refuges = await findNearbyRefuges(lat, lon, radius);
    res.json({ success: true, count: refuges.length, refuges });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`SenseWay data pipeline listening on port ${PORT}`);
});
