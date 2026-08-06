"use strict";

const FIFTEEN_MIN_MS = 15 * 60 * 1000;

// The City of Melbourne pedestrian data is recorded in Melbourne local time, so
// all day-of-week / hour-of-day bucketing for the forecast MUST be done in this
// zone - not the server's local zone. Cloud Run runs in UTC, so relying on
// Date.getHours()/getDay() would silently bucket by the wrong wall clock in
// production while looking correct on a Melbourne developer's laptop. Defined
// once here so the zone string never gets scattered or drifts.
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

/**
 * Given an absolute instant, return the day-of-week and hour-of-day as observed
 * on the wall clock in Melbourne, correctly accounting for daylight saving
 * (AEST +10 / AEDT +11) via the IANA database - never a hardcoded offset.
 *
 * @param {Date} date
 * @returns {{ dayOfWeek: number, hour: number }} dayOfWeek 0=Sun..6=Sat, hour 0-23
 */
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

/**
 * Round a Date down to the previous 15-minute boundary, so forecast intervals
 * always start on :00 / :15 / :30 / :45 and line up cleanly with a UI slider.
 */
function floorToQuarterHour(date) {
  const ms = date.getTime();
  return new Date(ms - (ms % FIFTEEN_MIN_MS));
}

/**
 * Produce `count` Date objects spaced 15 minutes apart, starting at `start`.
 */
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
