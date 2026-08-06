require('dotenv').config();
const express = require('express');
const { ingestSensorLocations } = require('./ingest/sensorLocations');
const { ingestHourCounts } = require('./ingest/hourCounts');
const { ingestMinuteCounts } = require('./ingest/minuteCounts');

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'senseway-data-pipeline' });
});

app.get('/ingest/sensor-locations', async (req, res) => {
  try {
    const result = await ingestSensorLocations();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/ingest/hour-counts', async (req, res) => {
  try {
    const result = await ingestHourCounts();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/ingest/minute-counts', async (req, res) => {
  try {
    const result = await ingestMinuteCounts();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`SenseWay data pipeline listening on port ${PORT}`);
});
