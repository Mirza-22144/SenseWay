import { useJsApiLoader } from "@react-google-maps/api";

const LIBRARIES = ["places"];

// Wraps @react-google-maps/api's loader; hasMapsKey tells callers whether to
// render the real map or fall back to a placeholder.
export function useGoogleMapsLoader() {
  // read the key from env - empty string if not set
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const hasMapsKey = Boolean(apiKey);

  // load the Google Maps JS SDK (no-op if apiKey is empty)
  const { isLoaded, loadError } = useJsApiLoader({
    id: "senseway-google-maps",
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
  });

  // only report loaded/error state when we actually have a key to load with
  return {
    hasMapsKey,
    isLoaded: hasMapsKey && isLoaded,
    loadError: hasMapsKey ? loadError : null,
  };
}
