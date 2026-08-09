const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export class ApiRequestError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.details = details;
  }
}

// POST /api/routes — see backend/API-CONTRACT.md.
export async function fetchRoutes({ start, destination }) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/routes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start, destination }),
    });
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
