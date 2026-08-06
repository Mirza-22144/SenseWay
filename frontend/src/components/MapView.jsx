import { GoogleMap, Marker, Polyline } from "@react-google-maps/api";
import { sensoryMeta } from "../utils/sensory";

const MAP_CONTAINER_STYLE = { width: "100%", height: "420px", borderRadius: "12px" };
const DEFAULT_CENTER = { lat: -37.8136, lng: 144.9631 };

function routeToPath(route) {
  const segments = route.segments || [];
  if (segments.length === 0) return [];
  const path = [{ lat: segments[0].fromLatitude, lng: segments[0].fromLongitude }];
  for (const segment of segments) {
    path.push({ lat: segment.toLatitude, lng: segment.toLongitude });
  }
  return path;
}

// AC 1.1.1 (recommended route highlighted, thicker line) + AC 1.1.3 (selecting
// an alternative re-highlights it and the previous route becomes a thinner
// secondary line). Per-segment shading/legend is Story 1.2, not here — each
// route is drawn as a single line coloured by its overall sensoryRating.
export default function MapView({ hasMapsKey, isLoaded, loadError, routes, selectedRouteId, start, destination }) {
  if (!hasMapsKey) {
    return (
      <div className="flex h-[420px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
        <p className="text-sm font-medium text-slate-600">Map preview needs a Google Maps API key</p>
        <p className="mt-1 max-w-sm text-xs text-slate-400">
          Add VITE_GOOGLE_MAPS_API_KEY in frontend/.env to see routes plotted on a live map. Route
          details are still available in the cards below.
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-700">
        Unable to display map. Please refresh the page.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
        Loading map…
      </div>
    );
  }

  const center = start ? { lat: start.latitude, lng: start.longitude } : DEFAULT_CENTER;

  return (
    <GoogleMap mapContainerStyle={MAP_CONTAINER_STYLE} center={center} zoom={15}>
      {start && <Marker position={{ lat: start.latitude, lng: start.longitude }} label="A" />}
      {destination && <Marker position={{ lat: destination.latitude, lng: destination.longitude }} label="B" />}
      {routes.map((route) => {
        const isSelected = route.routeId === selectedRouteId;
        return (
          <Polyline
            key={route.routeId}
            path={routeToPath(route)}
            options={{
              strokeColor: sensoryMeta(route.sensoryRating).mapColor,
              strokeWeight: isSelected ? 6 : 3,
              strokeOpacity: isSelected ? 0.95 : 0.5,
              zIndex: isSelected ? 2 : 1,
            }}
          />
        );
      })}
    </GoogleMap>
  );
}
