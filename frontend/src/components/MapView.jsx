import { useEffect, useRef, useState } from "react";
import { GoogleMap, Marker } from "@react-google-maps/api";
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
// re-highlights it) + AC 1.2.1 (the selected route is shaded segment-by-
// segment by pedestrian density, with a legend). Nothing selected: every
// route shown, colour-coded by band, recommended one thicker. Once the user
// selects a route, ONLY that one is shown - picking a different route
// replaces it entirely, and a new search erases everything from the old one.
//
// Polylines are drawn IMPERATIVELY here (not via @react-google-maps/api's
// <Polyline> component) because that component does not reliably tear down
// the underlying google.maps.Polyline overlay when its key/props change -
// confirmed by testing: a stale route stayed visibly drawn on the map even
// after route cards had already moved on to new data, across several
// remount/key/onUnmount-based fixes that should have worked per the
// library's own docs (see https://github.com/JustFly1984/react-google-maps-api/issues/3374).
// Managing the google.maps.Polyline objects directly - explicitly clearing
// every previous one before drawing new ones - is the only approach that
// reliably avoids this.
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
  const [map, setMap] = useState(null);
  const polylinesRef = useRef([]);

  const selectedRoute = routes.find((route) => route.routeId === selectedRouteId) || null;

  useEffect(() => {
    if (!map || !window.google) return undefined;

    // Clear every polyline from the previous render before drawing new ones.
    for (const polyline of polylinesRef.current) {
      polyline.setMap(null);
    }
    const drawn = [];

    if (!selectedRouteId) {
      for (const route of routes) {
        const isRecommended = route.routeId === recommendedRouteId;
        drawn.push(
          new window.google.maps.Polyline({
            map,
            path: routeToPath(route),
            strokeColor: sensoryMeta(route.sensoryRating).mapColor,
            strokeWeight: isRecommended ? 5 : 4,
            strokeOpacity: isRecommended ? 1 : 0.85,
            zIndex: isRecommended ? 2 : 1,
          })
        );
      }
    } else if (selectedRoute) {
      for (const segment of selectedRoute.segments || []) {
        drawn.push(
          new window.google.maps.Polyline({
            map,
            path: segmentPath(segment),
            ...(segment.hasLiveData
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
                }),
          })
        );
      }
    }

    polylinesRef.current = drawn;

    return () => {
      for (const polyline of drawn) {
        polyline.setMap(null);
      }
      polylinesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, routes, selectedRouteId, recommendedRouteId]);

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

  return (
    <div>
      <div className="relative">
        <GoogleMap
          mapContainerStyle={MAP_CONTAINER_STYLE}
          center={center}
          zoom={15}
          onLoad={setMap}
          onUnmount={() => setMap(null)}
        >
          {start && <Marker position={{ lat: start.latitude, lng: start.longitude }} label="A" />}
          {destination && <Marker position={{ lat: destination.latitude, lng: destination.longitude }} label="B" />}
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
