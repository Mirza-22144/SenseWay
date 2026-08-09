"use strict";

const env = require("../config/env");
const { metresForWalkingMinutes, haversineMetres, walkingMinutesForMetres } =
  require("../utils/geo");
const { refugeId } = require("../utils/ids");
const { ApiError } = require("../middleware/errorHandler");

// Sensory refuge finder: calls the pipeline's /refuge/nearby over HTTP (with
// one retry). No mock fallback - the pipeline is a required upstream, so an
// absent PIPELINE_URL or a failed call both throw ApiError.upstream(). Fields
// the open data doesn't contain are always null, never invented.

async function findNearby(latitude, longitude, walkingMinutes) {
  const radiusMetres = metresForWalkingMinutes(walkingMinutes);
  const origin = { latitude, longitude };

  if (!env.hasPipeline) {
    throw ApiError.upstream("Refuge information is currently unavailable.");
  }

  let refuges;
  try {
    refuges = await callPipelineWithRetry(latitude, longitude, radiusMetres, origin);
  } catch (err) {
    console.error("[refuge.service] pipeline call failed:", err.message);
    throw ApiError.upstream("Refuge information is currently unavailable.");
  }

  return {
    origin,
    walkingMinutes,
    radiusMetres,
    openingHoursKnown: false, // no opening hours anywhere in the landmark schema
    count: refuges.length,
    refuges,
    source: "live",
  };
}

// one retry after a transient failure before giving up honestly
async function callPipelineWithRetry(latitude, longitude, radiusMetres, origin) {
  try {
    return await callPipeline(latitude, longitude, radiusMetres, origin);
  } catch (err) {
    console.warn("[refuge.service] pipeline call failed, retrying once:", err.message);
    return await callPipeline(latitude, longitude, radiusMetres, origin);
  }
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
    return rows.map((r) => toRefuge(r, origin, r.distanceMetres));
  } finally {
    clearTimeout(timer);
  }
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

  const indoorOutdoor = deriveIndoorOutdoor(raw.theme, raw.subTheme);

  return {
    refugeId: refugeId(raw.name, raw.latitude, raw.longitude),
    name: raw.name,
    refugeType: deriveRefugeType(raw.theme, raw.subTheme),
    theme: raw.theme || null,
    subTheme: raw.subTheme || null,
    latitude: raw.latitude,
    longitude: raw.longitude,
    distanceMetres: dist,
    walkingMinutes: walkingMinutesForMetres(dist),
    indoorOutdoor,
    attributes: deriveAttributes(indoorOutdoor), // only tags we can justify from the data
    // not in the Landmarks dataset - always null, never invented
    openingHoursToday: null,
    photoUrl: null,
    accessibleEntrance: null,
  };
}

// theme+subTheme -> user-facing refuge type (see README for the full table);
// falls back to "Public space" when nothing matches
function deriveRefugeType(theme, subTheme) {
  const text = `${theme || ""} ${subTheme || ""}`.toLowerCase();
  if (/library/.test(text)) return "Library";
  if (/garden|park|reserve/.test(text)) return "Park";
  if (/cafe|coffee/.test(text)) return "Quiet cafe";
  if (/gallery|museum/.test(text)) return "Gallery or museum";
  if (/worship|cathedral|church|chapel|temple|mosque|synagogue/.test(text))
    return "Place of worship";
  if (/hall/.test(text)) return "Community hall";
  if (/theatre/.test(text)) return "Theatre";
  return "Public space";
}

// only "Indoor" is defensible from this dataset - Seated/Quiet/Low-light
// aren't in the data, so we don't claim them; [] when nothing is justified
function deriveAttributes(indoorOutdoor) {
  if (indoorOutdoor === "indoor") return ["Indoor"];
  return [];
}

// indoor/outdoor only where the words genuinely imply it; ambiguous -> null (not a guess)
function deriveIndoorOutdoor(theme, subTheme) {
  const text = `${theme || ""} ${subTheme || ""}`.toLowerCase();
  if (/garden|park|reserve|oval|square|outdoor/.test(text)) return "outdoor";
  if (
    /worship|cathedral|church|library|hall|theatre|gallery|museum|cafe|indoor/.test(
      text
    )
  ) {
    return "indoor";
  }
  return null;
}

module.exports = {
  findNearby,
  deriveIndoorOutdoor,
  deriveRefugeType,
  deriveAttributes,
};
