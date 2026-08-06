"use strict";

const env = require("../config/env");
const { metresForWalkingMinutes, haversineMetres, walkingMinutesForMetres } =
  require("../utils/geo");
const { refugeId } = require("../utils/ids");
const { getMockRefuges } = require("../data/mockRefuges");

/**
 * Sensory refuge finder (US2.1).
 *
 * Real path: call the pipeline's existing /refuge/nearby endpoint over HTTP with
 * a timeout. We CALL its correct parameterised distance query rather than
 * re-implementing it. It takes a radius in metres, so we convert the caller's
 * walking-minutes using the named 80 m/min constant first.
 *
 * Mock path: when PIPELINE_URL is absent or the call fails, filter the mock
 * refuge fixtures by the same radius. Response shape is identical either way.
 *
 * Fields the open data does not contain (openNow, seatingAvailable, noiseLevel)
 * are ALWAYS null - never invented. There are no opening hours in the schema,
 * so openingHoursKnown is always false and openNow is always null.
 */

async function findNearby(latitude, longitude, walkingMinutes) {
  const radiusMetres = metresForWalkingMinutes(walkingMinutes);
  const origin = { latitude, longitude };

  let refuges;
  let source;

  if (env.hasPipeline) {
    try {
      refuges = await callPipeline(latitude, longitude, radiusMetres, origin);
      source = "live";
    } catch (err) {
      console.warn(
        "[refuge.service] pipeline call failed, using mock:",
        err.message
      );
      refuges = mockNearby(origin, radiusMetres);
      source = "mock";
    }
  } else {
    refuges = mockNearby(origin, radiusMetres);
    source = "mock";
  }

  return {
    origin,
    walkingMinutes,
    radiusMetres,
    // No opening hours exist anywhere in the landmark schema.
    openingHoursKnown: false,
    count: refuges.length,
    refuges,
    source,
  };
}

async function callPipeline(latitude, longitude, radiusMetres, origin) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.pipelineTimeoutMs);
  try {
    const url =
      `${env.pipelineUrl.replace(/\/$/, "")}/refuge/nearby` +
      `?lat=${encodeURIComponent(latitude)}` +
      `&lon=${encodeURIComponent(longitude)}` +
      `&radius=${encodeURIComponent(radiusMetres)}`;

    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`pipeline responded ${res.status}`);
    }
    const body = await res.json();
    const rows = Array.isArray(body.refuges) ? body.refuges : [];
    // The pipeline already computed distanceMetres; keep it and add our derived
    // contract fields.
    return rows.map((r) => toRefuge(r, origin, r.distanceMetres));
  } finally {
    clearTimeout(timer);
  }
}

function mockNearby(origin, radiusMetres) {
  return getMockRefuges()
    .map((r) => ({
      raw: r,
      distanceMetres: Math.round(
        haversineMetres(origin.latitude, origin.longitude, r.latitude, r.longitude)
      ),
    }))
    .filter((x) => x.distanceMetres <= radiusMetres)
    .sort((a, b) => a.distanceMetres - b.distanceMetres)
    .map((x) => toRefuge(x.raw, origin, x.distanceMetres));
}

function toRefuge(raw, origin, distanceMetres) {
  const dist =
    typeof distanceMetres === "number"
      ? Math.round(distanceMetres)
      : Math.round(
          haversineMetres(
            origin.latitude,
            origin.longitude,
            raw.latitude,
            raw.longitude
          )
        );

  return {
    refugeId: refugeId(raw.name, raw.latitude, raw.longitude),
    name: raw.name,
    theme: raw.theme || null,
    subTheme: raw.subTheme || null,
    latitude: raw.latitude,
    longitude: raw.longitude,
    distanceMetres: dist,
    walkingMinutes: walkingMinutesForMetres(dist),
    indoorOutdoor: deriveIndoorOutdoor(raw.theme, raw.subTheme),
    // Not present in the landmark open data - null, never guessed.
    openNow: null,
    seatingAvailable: null,
    noiseLevel: null,
  };
}

/**
 * Derive indoor/outdoor from theme/subTheme ONLY where the words genuinely
 * imply it (a garden is outdoors; a library/cathedral hall is indoors).
 * Anything ambiguous returns null rather than a guess.
 */
function deriveIndoorOutdoor(theme, subTheme) {
  const text = `${theme || ""} ${subTheme || ""}`.toLowerCase();
  if (/garden|park|reserve|oval|square|outdoor/.test(text)) return "outdoor";
  if (
    /worship|cathedral|church|library|hall|theatre|gallery|museum|indoor/.test(
      text
    )
  ) {
    return "indoor";
  }
  return null;
}

module.exports = { findNearby, deriveIndoorOutdoor };
