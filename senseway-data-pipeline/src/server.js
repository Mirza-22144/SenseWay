require('dotenv').config();
const express = require('express');
const { ingestSensorLocations } = require('./ingest/sensorLocations');
const { ingestHourCounts } = require('./ingest/hourCounts');
const { ingestMinuteCounts } = require('./ingest/minuteCounts');
const { ingestLandmarks } = require('./ingest/landmarks');

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

app.listen(PORT, () => {
  console.log(`SenseWay data pipeline listening on port ${PORT}`);
});
