import { useJsApiLoader } from "@react-google-maps/api";

const LIBRARIES = ["places"];

// Wraps @react-google-maps/api's loader so the rest of the app can ask one
// question: do we have a real map (Places Autocomplete + GoogleMap), or should
// we fall back to the built-in Melbourne CBD picker / placeholder map panel?
export function useGoogleMapsLoader() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const hasMapsKey = Boolean(apiKey);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "senseway-google-maps",
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
  });

  return {
    hasMapsKey,
    isLoaded: hasMapsKey && isLoaded,
    loadError: hasMapsKey ? loadError : null,
  };
}
