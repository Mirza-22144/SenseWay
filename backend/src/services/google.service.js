"use strict";

const env = require("../config/env");
const polyline = require("../utils/polyline");
const { getMockRoutes } = require("../data/mockRoutes");
const { haversineMetres } = require("../utils/geo");

// If start and destination are essentially the same point, there is no route to
// walk. Used to exercise the no-routes path deterministically in mock mode.
const SAME_POINT_METRES = 5;

/**
 * Candidate walking routes.
 *
 * WHY the key stays here: the Google Maps API key is read ONLY by this backend
 * (from env) and is never placed in any response. The browser never sees it, so
 * it can't be scraped from network traffic and used to run up our bill. This is
 * the whole reason the frontend talks to us instead of Google directly.
 *
 * Real path (GOOGLE_MAPS_API_KEY present): call the Google Routes API with a
 * timeout, request alternative routes, and normalise them into candidate routes
 * with decoded geometry. Segment-level crowd scoring is added later by the route
 * service from pedestrian data.
 *
 * Mock path (key absent OR the call fails): return the rich mock candidates,
 * which already include segment-level scores. Response shape is identical, so
 * nothing downstream changes when the key arrives - it is a config change only.
 *
 * @returns {Promise<{candidates: object[], source: "live"|"mock"}>}
 */
async function getCandidateRoutes(start, destination) {
  // No usable route when origin and destination are the same place. Returning
  // an empty candidate list lets the route service report noRoutesAvailable
  // (AC 1.1.1 "No routes available" / AC 2.1.3 "Unable to generate directions").
  const straightLine = haversineMetres(
    start.latitude,
    start.longitude,
    destination.latitude,
    destination.longitude
  );
  if (straightLine < SAME_POINT_METRES) {
    return { candidates: [], source: env.hasGoogleKey ? "live" : "mock" };
  }

  if (!env.hasGoogleKey) {
    return { candidates: getMockRoutes(), source: "mock" };
  }

  try {
    const candidates = await callGoogleRoutes(start, destination);
    if (candidates.length === 0) {
      // Google answered but found nothing usable - fall back rather than return
      // an empty route list.
      console.warn("[google.service] no routes returned, using mock");
      return { candidates: getMockRoutes(), source: "mock" };
    }
    return { candidates, source: "live" };
  } catch (err) {
    console.warn(
      "[google.service] Routes API call failed, using mock:",
      err.message
    );
    return { candidates: getMockRoutes(), source: "mock" };
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
        // Field mask keeps the response small and the bill predictable. Steps
        // are the turn-by-turn instructions for the "Get Navigation" feature.
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
        // Decoded vertices; the route service samples these into segments and
        // scores each against nearby pedestrian sensors.
        points: encoded ? polyline.decode(encoded) : [],
        // These are filled by the route service from live pedestrian data.
        segments: null,
        sensorsUsed: [],
        congestionPoints: [],
        bypassedAreas: [],
        averageCountPerHour: null,
        // Turn-by-turn walking directions ("Get Navigation").
        steps: flattenSteps(r.legs),
      };
    });
  } finally {
    clearTimeout(timer);
  }
}

function latLng(point) {
  return { latitude: point.latitude, longitude: point.longitude };
}

// Google returns one leg for a simple origin->destination walk (no
// waypoints), each with its own ordered steps. Flatten to a single ordered
// list for the "Get Navigation" turn-by-turn panel.
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
