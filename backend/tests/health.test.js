"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer, baseUrl, closeServer } = require("./helpers");

let server;
let url;

before(async () => {
  server = await startServer();
  url = baseUrl(server);
});
after(async () => closeServer(server));

test("GET /api/health returns 200 and status ok", async () => {
  const res = await fetch(`${url}/api/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "ok");
  assert.equal(body.service, "senseway-backend");
  assert.ok(body.timestamp, "timestamp present");
});

test("health returns 200 even when the database is unreachable", async () => {
  // The health controller never touches the database by design, so it stays 200
  // regardless of DB state. In this test run no DB is configured at all, which
  // is exactly the "database unreachable" condition - and health still passes.
  const res = await fetch(`${url}/api/health`);
  assert.equal(res.status, 200);
});

test("GET / still returns the original welcome message", async () => {
  const res = await fetch(`${url}/`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.equal(text, "Welcome to SenseWay Backend");
});

test("unknown URL returns a JSON 404, not HTML", async () => {
  const res = await fetch(`${url}/api/does-not-exist`);
  assert.equal(res.status, 404);
  assert.match(res.headers.get("content-type") || "", /application\/json/);
  const body = await res.json();
  assert.equal(body.error.code, "NOT_FOUND");
});
