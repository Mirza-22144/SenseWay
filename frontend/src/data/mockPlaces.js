// Fallback location picker used when no Google Maps API key is configured
// (see SearchBar). All points are real, well-known Melbourne CBD landmarks —
// this stands in for Google Places Autocomplete until VITE_GOOGLE_MAPS_API_KEY
// is set, mirroring how the backend's src/data/ mock fixtures stand in for
// live Google/pipeline calls.
export const MELBOURNE_PLACES = [
  { name: "Flinders Street Station", latitude: -37.8183, longitude: 144.9671 },
  { name: "Federation Square", latitude: -37.818, longitude: 144.969 },
  { name: "Melbourne Central", latitude: -37.81, longitude: 144.9631 },
  { name: "State Library Victoria", latitude: -37.8098, longitude: 144.9652 },
  { name: "Melbourne Town Hall", latitude: -37.8148, longitude: 144.9669 },
  { name: "Bourke Street Mall", latitude: -37.8136, longitude: 144.9648 },
  { name: "Queen Victoria Market", latitude: -37.8076, longitude: 144.9568 },
  { name: "Southern Cross Station", latitude: -37.8183, longitude: 144.9524 },
  { name: "Parliament House", latitude: -37.8103, longitude: 144.9732 },
  { name: "RMIT University", latitude: -37.8076, longitude: 144.9631 },
  { name: "Crown Casino", latitude: -37.8226, longitude: 144.9586 },
  { name: "NGV International", latitude: -37.8226, longitude: 144.9689 },
];
