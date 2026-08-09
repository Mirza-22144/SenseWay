import { ApiRequestError } from "./routesApi";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

// GET /api/refuges/nearby — see backend/API-CONTRACT.md.
export async function fetchNearbyRefuges({ latitude, longitude, walkingMinutes }) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
  });
  if (walkingMinutes) params.set("walkingMinutes", String(walkingMinutes));

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/refuges/nearby?${params.toString()}`);
  } catch {
    throw new ApiRequestError(
      "NETWORK_ERROR",
      "Unable to reach the SenseWay server. Please check your connection and try again."
    );
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const error = body && body.error ? body.error : {};
    throw new ApiRequestError(
      error.code || "UNKNOWN_ERROR",
      error.message || "Something went wrong. Please try again.",
      error.details || []
    );
  }

  return body;
}
