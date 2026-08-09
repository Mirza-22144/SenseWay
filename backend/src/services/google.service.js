"use strict";

const env = require("../config/env");
const polyline = require("../utils/polyline");
const { haversineMetres } = require("../utils/geo");
const { ApiError } = require("../middleware/errorHandler");

const SAME_POINT_METRES = 5;

/**
 * Candidate walking routes from Google Routes API. The API key is read only
 * here (from env) and never placed in any response, so the browser can't
 * scrape and reuse it. Segment-level crowd scoring is added later by the
 * route service. No mock fallback - Google is a required upstream.
 */
async function getCandidateRoutes(start, destination) {
  // same origin/destination -> no route -> empty candidates (not an error)
  const straightLine = haversineMetres(
    start.latitude,
    start.longitude,
    destination.latitude,
    destination.longitude
  );
  if (straightLine < SAME_POINT_METRES) {
    return { candidates: [], source: "live" };
  }

  if (!env.hasGoogleKey) {
    throw ApiError.upstream("Unable to compute routes right now.");
  }

  try {
    // Google answering with zero usable routes is a legitimate outcome, not a failure
    const candidates = await callGoogleRoutes(start, destination);
    return { candidates, source: "live" };
  } catch (err) {
    console.error("[google.service] Routes API call failed:", err.message);
    throw ApiError.upstream("Unable to compute routes right now.");
  }
}

const ROUTES_ENDPOINT =
  "https://routes.googleapis.com/directions/v2:computeRoutes";

async function callGoogleRoutes(start, destination) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.googleTimeoutMs);

  try {
    const res = await fetch(ROUTES_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": env.googleMapsApiKey,
        // field mask keeps the response small; steps are for "Get Navigation"
        "X-Goog-FieldMask":
          "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.description," +
          "routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration",
      },
      body: JSON.stringify({
        origin: { location: { latLng: latLng(start) } },
        destination: { location: { latLng: latLng(destination) } },
        travelMode: "WALK",
        computeAlternativeRoutes: true,
        polylineQuality: "HIGH_QUALITY",
        languageCode: "en-AU",
        units: "METRIC",
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Google Routes ${res.status}: ${text.slice(0, 200)}`);
    }

    const body = await res.json();
    const routes = Array.isArray(body.routes) ? body.routes : [];

    return routes.map((r, i) => {
      const encoded = r.polyline && r.polyline.encodedPolyline;
      return {
        routeId: `route-${i + 1}`,
        summary: r.description || "Walking route",
        durationMinutes: parseGoogleDuration(r.duration),
        distanceMetres: r.distanceMeters || null,
        polyline: encoded || null,
        points: encoded ? polyline.decode(encoded) : [], // sampled into segments and scored later
        // filled in later by the route service from live pedestrian data
        segments: null,
        sensorsUsed: [],
        congestionPoints: [],
        bypassedAreas: [],
        averageCountPerHour: null,
        steps: flattenSteps(r.legs), // "Get Navigation" turn-by-turn
      };
    });
  } finally {
    clearTimeout(timer);
  }
}

function latLng(point) {
  return { latitude: point.latitude, longitude: point.longitude };
}

// flattens Google's per-leg steps into one ordered list (no waypoints -> one leg)
function flattenSteps(legs) {
  if (!Array.isArray(legs)) return [];
  const steps = [];
  for (const leg of legs) {
    for (const step of leg.steps || []) {
      steps.push({
        instruction: (step.navigationInstruction && step.navigationInstruction.instructions) || null,
        distanceMetres: typeof step.distanceMeters === "number" ? step.distanceMeters : null,
        durationMinutes: parseGoogleDuration(step.staticDuration),
      });
    }
  }
  return steps;
}

// Google durations look like "1140s".
function parseGoogleDuration(duration) {
  if (typeof duration !== "string") return null;
  const seconds = parseInt(duration.replace(/[^0-9]/g, ""), 10);
  if (!Number.isFinite(seconds)) return null;
  return Math.round(seconds / 60);
}

module.exports = { getCandidateRoutes };
