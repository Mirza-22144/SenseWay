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

// Dashed-line recipe for "no live data" segments: hide the solid stroke,
// repeat a short line symbol along the path instead.
const NO_DATA_ICONS = [
  {
    icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
    offset: "0",
    repeat: "12px",
  },
];

// full route outline: every segment's endpoints, in order
function routeToPath(route) {
  const segments = route.segments || [];
  if (segments.length === 0) return [];
  const path = [{ lat: segments[0].fromLatitude, lng: segments[0].fromLongitude }];
  for (const segment of segments) {
    path.push({ lat: segment.toLatitude, lng: segment.toLongitude });
  }
  return path;
}

// one segment's two endpoints
function segmentPath(segment) {
  return [
    { lat: segment.fromLatitude, lng: segment.fromLongitude },
    { lat: segment.toLatitude, lng: segment.toLongitude },
  ];
}

// Nothing selected: every route shown, colour-coded, recommended one
// thicker. Once a route is selected, only that one is shown.
//
// Polylines are drawn imperatively (not via @react-google-maps/api's
// <Polyline>) because that component doesn't reliably tear down its
// underlying overlay on prop changes - see
// https://github.com/JustFly1984/react-google-maps-api/issues/3374.
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
      // no selection: draw every route, colour-coded, recommended one thicker
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
      // one route selected: draw it segment by segment so each can be
      // shaded by its own sensory rating (or dashed if it has no live data)
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
