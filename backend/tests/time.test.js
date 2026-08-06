"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { melbourneParts, MELBOURNE_TZ } = require("../src/utils/time");

// Two fixed absolute instants, chosen to sit either side of Melbourne daylight
// saving:
//   winter: 2026-08-05T23:30:00Z = Thu 2026-08-06 09:30 AEST (+10)
//   summer: 2026-01-05T14:30:00Z = Tue 2026-01-06 01:30 AEDT (+11)
const WINTER = "2026-08-05T23:30:00Z";
const SUMMER = "2026-01-05T14:30:00Z";
const EXPECTED_WINTER = { dayOfWeek: 4, hour: 9 }; // Thursday 09:00 bucket
const EXPECTED_SUMMER = { dayOfWeek: 2, hour: 1 }; // Tuesday 01:00 bucket (DST)

test("melbourneParts buckets by Melbourne wall clock, DST-aware", () => {
  assert.equal(MELBOURNE_TZ, "Australia/Melbourne");
  assert.deepEqual(melbourneParts(new Date(WINTER)), EXPECTED_WINTER);
  assert.deepEqual(melbourneParts(new Date(SUMMER)), EXPECTED_SUMMER);
});

// Regression guard for the Cloud-Run-runs-UTC bug: run the bucketing in a child
// process forced to TZ=UTC and assert the buckets are unchanged. If anyone
// reverts to Date.getHours()/getDay() (server-local time), this fails, because
// under UTC the winter instant would bucket to hour 23 / Wednesday instead of
// hour 9 / Thursday.
test("day/hour bucketing is stable under TZ=UTC (does not use server local time)", () => {
  const timeModule = path.resolve(__dirname, "../src/utils/time.js");
  const script = `
    const { melbourneParts } = require(${JSON.stringify(timeModule)});
    process.stdout.write(JSON.stringify({
      winter: melbourneParts(new Date(${JSON.stringify(WINTER)})),
      summer: melbourneParts(new Date(${JSON.stringify(SUMMER)})),
    }));
  `;

  const out = execFileSync(process.execPath, ["-e", script], {
    env: { ...process.env, TZ: "UTC" },
    encoding: "utf8",
  });
  const result = JSON.parse(out);

  assert.deepEqual(result.winter, EXPECTED_WINTER);
  assert.deepEqual(result.summer, EXPECTED_SUMMER);
});
