import { GoogleMap, Marker, Polyline } from "@react-google-maps/api";
import MapLegend from "./MapLegend";
import { sensoryMeta } from "../utils/sensory";

const MAP_CONTAINER_STYLE = {
  width: "100%",
  height: "460px",
  borderRadius: "12px",
};
const DEFAULT_CENTER = { lat: -37.8136, lng: 144.9631 };

// Standard Google Maps dashed-line recipe: hide the solid stroke, repeat a
// short line symbol along the path instead. Used for AC 1.2.1's "no live
// data" segments.
const NO_DATA_ICONS = [
  {
    icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
    offset: "0",
    repeat: "12px",
  },
];

function routeToPath(route) {
  const segments = route.segments || [];
  if (segments.length === 0) return [];
  const path = [{ lat: segments[0].fromLatitude, lng: segments[0].fromLongitude }];
  for (const segment of segments) {
    path.push({ lat: segment.toLatitude, lng: segment.toLongitude });
  }
  return path;
}

function segmentPath(segment) {
  return [
    { lat: segment.fromLatitude, lng: segment.fromLongitude },
    { lat: segment.toLatitude, lng: segment.toLongitude },
  ];
}

// AC 1.1.1 (recommended route highlighted, thicker line, WITHOUT requiring
// the user to select anything first) + AC 1.1.3 (selecting an alternative
// re-highlights it, previous route becomes a thinner secondary line) +
// AC 1.2.1 (the selected route is shaded segment-by-segment by pedestrian
// density, with a legend — that per-segment detail only appears once the
// user actually picks a route from the cards, per AC 1.2.1's own "Given the
// user has selected a route" precondition). Non-selected routes stay a
// single line colored by their overall sensoryRating — full per-segment
// shading for every route on screen at once would be unreadable with three
// routes stacked.
export default function MapView({
  hasMapsKey,
  isLoaded,
  loadError,
  routes,
  selectedRouteId,
  recommendedRouteId,
  start,
  destination,
}) {
  if (!hasMapsKey) {
    return (
      <div className="flex h-[460px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-line bg-base p-6 text-center">
        <p className="text-sm font-medium text-secondary">Map preview needs a Google Maps API key</p>
        <p className="mt-1 max-w-sm text-xs text-muted">
          Add VITE_GOOGLE_MAPS_API_KEY in frontend/.env to see routes plotted on a live map. Route
          details are still available in the cards below.
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-[460px] items-center justify-center rounded-xl border border-danger-subtle bg-danger-subtle text-sm text-danger-ink">
        Unable to display map. Please refresh the page.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-[460px] items-center justify-center rounded-xl border border-line bg-base text-sm text-secondary">
        Loading map…
      </div>
    );
  }

  const center = start ? { lat: start.latitude, lng: start.longitude } : DEFAULT_CENTER;
  const selectedRoute = routes.find((route) => route.routeId === selectedRouteId) || null;
  // Before the user picks anything, the recommended route still gets the
  // AC 1.1.1 "thicker line" treatment — just without becoming "selected"
  // (no per-segment shading, no card highlight, no Get Navigation).
  const highlightRouteId = selectedRouteId || recommendedRouteId;

  return (
    <div>
      <div className="relative">
        <GoogleMap mapContainerStyle={MAP_CONTAINER_STYLE} center={center} zoom={15}>
          {start && <Marker position={{ lat: start.latitude, lng: start.longitude }} label="A" />}
          {destination && <Marker position={{ lat: destination.latitude, lng: destination.longitude }} label="B" />}

          {routes
            .filter((route) => route.routeId !== selectedRouteId)
            .map((route) => {
              const isHighlighted = !selectedRouteId && route.routeId === highlightRouteId;
              return (
                <Polyline
                  key={route.routeId}
                  path={routeToPath(route)}
                  options={{
                    strokeColor: sensoryMeta(route.sensoryRating).mapColor,
                    // Nothing selected yet: every route stays visible so the
                    // user can browse Low/Moderate/High, but the recommended
                    // one is drawn thicker and fully opaque (AC 1.1.1). Once
                    // something IS selected, the rest dim down to secondary
                    // lines regardless of which was recommended.
                    strokeWeight: selectedRouteId ? 3 : isHighlighted ? 5 : 4,
                    strokeOpacity: selectedRouteId ? 0.5 : isHighlighted ? 1 : 0.85,
                    zIndex: isHighlighted ? 2 : 1,
                  }}
                />
              );
            })}

          {selectedRoute &&
            (selectedRoute.segments || []).map((segment) => (
              <Polyline
                key={segment.segmentId}
                path={segmentPath(segment)}
                options={
                  segment.hasLiveData
                    ? {
                        strokeColor: sensoryMeta(segment.sensoryRating).mapColor,
                        strokeWeight: 6,
                        strokeOpacity: 0.95,
                        zIndex: 2,
                      }
                    : {
                        strokeColor: sensoryMeta("Unknown").mapColor,
                        strokeOpacity: 0,
                        strokeWeight: 6,
                        icons: NO_DATA_ICONS,
                        zIndex: 2,
                      }
                }
              />
            ))}
        </GoogleMap>

        <div className="absolute right-4 top-4">
          <MapLegend />
        </div>
      </div>

      {selectedRoute?.sensorCoverage === "none" && (
        <p className="mt-2 text-xs text-muted">Our sensor network does not cover this route.</p>
      )}
    </div>
  );
}
