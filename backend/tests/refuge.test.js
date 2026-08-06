"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer, baseUrl, closeServer } = require("./helpers");
const refugeService = require("../src/services/refuge.service");

let server;
let url;

before(async () => {
  server = await startServer();
  url = baseUrl(server);
});
after(async () => closeServer(server));

test("refuges endpoint converts 5 walking minutes to 400 metres", async () => {
  const res = await fetch(
    `${url}/api/refuges/nearby?latitude=-37.8136&longitude=144.9631&walkingMinutes=5`
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.walkingMinutes, 5);
  assert.equal(body.radiusMetres, 400); // 5 min * 80 m/min
});

test("refuges are sorted by walking time ascending and expose AC fields", async () => {
  const res = await fetch(
    `${url}/api/refuges/nearby?latitude=-37.8100&longitude=144.9660&walkingMinutes=10`
  );
  const body = await res.json();
  assert.equal(body.openingHoursKnown, false);
  assert.ok(body.count >= 1, "expected at least one mock refuge in range");

  // Sorted nearest-first (AC 2.1.1).
  for (let i = 1; i < body.refuges.length; i += 1) {
    assert.ok(
      body.refuges[i].walkingMinutes >= body.refuges[i - 1].walkingMinutes,
      "refuges sorted by walking time ascending"
    );
  }

  for (const r of body.refuges) {
    assert.ok(typeof r.refugeType === "string" && r.refugeType.length > 0);
    assert.ok(Array.isArray(r.attributes));
    // Fields not present in the Landmarks dataset must be null, never invented.
    assert.equal(r.openingHoursToday, null);
    assert.equal(r.photoUrl, null);
    assert.equal(r.accessibleEntrance, null);
    assert.ok("indoorOutdoor" in r);
  }
});

test("refuges endpoint rejects missing coordinates with 400", async () => {
  const res = await fetch(`${url}/api/refuges/nearby?walkingMinutes=5`);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, "INVALID_REQUEST");
});

test("refugeType maps theme/sub_theme to user-facing vocabulary", () => {
  assert.equal(refugeService.deriveRefugeType("Place Of Assembly", "Library"), "Library");
  assert.equal(refugeService.deriveRefugeType("Leisure/Recreation", "Park/Garden"), "Park");
  assert.equal(refugeService.deriveRefugeType("Place of Worship", "Cathedral"), "Place of worship");
  assert.equal(refugeService.deriveRefugeType("Place Of Assembly", "Hall"), "Community hall");
});

test("indoorOutdoor is accurate from theme and attributes stay justifiable", () => {
  assert.equal(refugeService.deriveIndoorOutdoor("Place Of Assembly", "Library"), "indoor");
  assert.equal(refugeService.deriveIndoorOutdoor("Leisure/Recreation", "Park/Garden"), "outdoor");
  // Only "Indoor" is justifiable from the dataset; outdoor/ambiguous => [].
  assert.deepEqual(refugeService.deriveAttributes("indoor"), ["Indoor"]);
  assert.deepEqual(refugeService.deriveAttributes("outdoor"), []);
  assert.deepEqual(refugeService.deriveAttributes(null), []);
});
