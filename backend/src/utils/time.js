"use strict";

const FIFTEEN_MIN_MS = 15 * 60 * 1000;

// forecast bucketing must use Melbourne wall-clock time, not the server's
// (Cloud Run runs in UTC) - defined once so this never drifts
const MELBOURNE_TZ = "Australia/Melbourne";

// en-US gives stable English weekday abbreviations (Sun..Sat); map them to the
// same 0=Sunday..6=Saturday convention Postgres EXTRACT(DOW ...) uses.
const WEEKDAY_TO_DOW = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

// day-of-week (0=Sun..6=Sat) and hour (0-23) on the Melbourne wall clock,
// DST-aware via the IANA database
function melbourneParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MELBOURNE_TZ,
    weekday: "short",
    hour: "2-digit",
    // h23 => hours 00-23, so midnight is 0 (not 24).
    hourCycle: "h23",
  }).formatToParts(date);

  let weekday;
  let hour;
  for (const p of parts) {
    if (p.type === "weekday") weekday = p.value;
    else if (p.type === "hour") hour = parseInt(p.value, 10);
  }

  return { dayOfWeek: WEEKDAY_TO_DOW[weekday], hour: hour % 24 };
}

// rounds down to the previous :00/:15/:30/:45 boundary
function floorToQuarterHour(date) {
  const ms = date.getTime();
  return new Date(ms - (ms % FIFTEEN_MIN_MS));
}

// `count` Dates, 15 minutes apart, starting at `start`
function quarterHourSteps(start, count) {
  const base = floorToQuarterHour(start).getTime();
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push(new Date(base + i * FIFTEEN_MIN_MS));
  }
  return out;
}

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

module.exports = {
  FIFTEEN_MIN_MS,
  MELBOURNE_TZ,
  melbourneParts,
  floorToQuarterHour,
  quarterHourSteps,
  isValidDate,
};
