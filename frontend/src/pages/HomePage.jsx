import { useState } from "react";
import SearchBar from "../components/SearchBar";
import MapView from "../components/MapView";
import RouteCardList from "../components/RouteCardList";
import RouteSummary from "../components/RouteSummary";
import CongestionSummary from "../components/CongestionSummary";
import SensoryDetailsModal from "../components/SensoryDetailsModal";
import TurnByTurnModal from "../components/TurnByTurnModal";
import Banner from "../components/Banner";
import { useGoogleMapsLoader } from "../hooks/useGoogleMapsLoader";
import { fetchRoutes, ApiRequestError } from "../services/routesApi";

// Owns all state for User Stories 1.1 (search -> sensory-coded route options ->
// select an alternative -> view sensory rating details) and 1.2 (congestion
// shading, congestion summary, quieter alternative). Layout matches the
// Figma "Home / Sensory Route Planning" and "Congested Corridor
// Visualisation" frames: a two-column body under a page header.
export default function HomePage({ onFindQuietSpace }) {
  const { hasMapsKey, isLoaded, loadError } = useGoogleMapsLoader();

  const [start, setStart] = useState(null);
  const [destination, setDestination] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [recommendedRouteId, setRecommendedRouteId] = useState(null);
  const [fastestRouteId, setFastestRouteId] = useState(null);
  const [quieterAlternativeRouteId, setQuieterAlternativeRouteId] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(null);
  const [modalRoute, setModalRoute] = useState(null);
  const [navigationRoute, setNavigationRoute] = useState(null);

  async function handleFindRoute() {
    if (!start || !destination) return;

    setLoading(true);
    setBanner(null);

    try {
      const data = await fetchRoutes({
        start: { latitude: start.latitude, longitude: start.longitude },
        destination: { latitude: destination.latitude, longitude: destination.longitude },
      });

      const fetchedRoutes = data.routes || [];
      setRoutes(fetchedRoutes);
      setRecommendedRouteId(data.recommendedRouteId);
      setFastestRouteId(data.fastestRouteId || null);
      setQuieterAlternativeRouteId(data.quieterAlternativeRouteId || null);
      // Nothing is "selected" yet — the user picks explicitly (no card
      // highlight, no Get Navigation, no per-segment map shading until then).
      // MapView still highlights the recommended route with a thicker line by
      // default to satisfy AC 1.1.1 without this being a full selection.
      setSelectedRouteId(null);

      if (fetchedRoutes.length === 0) {
        setBanner({ variant: "warning", text: "No routes available for these locations." });
      } else if (fetchedRoutes.every((route) => route.dataState === "unavailable")) {
        setBanner({ variant: "warning", text: "Live sensory data unavailable." });
      }
    } catch (error) {
      setRoutes([]);
      setRecommendedRouteId(null);
      setFastestRouteId(null);
      setQuieterAlternativeRouteId(null);
      setSelectedRouteId(null);

      if (error instanceof ApiRequestError && error.details?.some((d) => d.includes("Melbourne CBD"))) {
        setBanner({ variant: "error", text: "Please enter a valid Melbourne CBD location." });
      } else if (error instanceof ApiRequestError) {
        setBanner({ variant: "error", text: error.message });
      } else {
        setBanner({ variant: "error", text: "Something went wrong. Please try again." });
      }
    } finally {
      setLoading(false);
    }
  }

  const selectedRoute = routes.find((route) => route.routeId === selectedRouteId) || null;
  const fastestRoute = routes.find((route) => route.routeId === fastestRouteId) || null;
  const statusIds = { recommendedRouteId, fastestRouteId, quieterAlternativeRouteId };

  // AC 1.2.1: "if live pedestrian data is unavailable... display the banner
  // 'Live sensory data unavailable.'" for the route currently being viewed.
  // Suppressed when the search-level banner above is already showing the
  // identical message (every route lacks data) to avoid a visible duplicate.
  const liveDataUnavailable =
    selectedRoute?.dataState === "unavailable" && banner?.text !== "Live sensory data unavailable.";
  // AC 1.2.3: the recommended route has high-crowd exposure but no qualifying
  // quieter alternative was found (too slow, or none exists) — the "no live
  // data" case is already covered by the banner above, so don't double up.
  const showNoQuieterAlternativeNote =
    !liveDataUnavailable &&
    !quieterAlternativeRouteId &&
    Boolean(fastestRoute) &&
    fastestRoute.highCrowdDistanceMetres > 0;

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-8 px-16 py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-primary">Plan Your Route</h1>
          <p className="text-base text-secondary">Find a lower-sensory route across Melbourne CBD.</p>
        </div>
        <button
          type="button"
          onClick={onFindQuietSpace}
          className="w-fit shrink-0 cursor-pointer rounded-lg border border-brand px-5 py-3 text-sm font-semibold text-brand-ink hover:bg-brand-subtle"
        >
          Find a Quiet Space
        </button>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <div className="flex w-full flex-col gap-5 lg:w-[540px] lg:shrink-0">
          <SearchBar
            hasMapsKey={hasMapsKey}
            isLoaded={isLoaded}
            start={start}
            destination={destination}
            onChangeStart={setStart}
            onChangeDestination={setDestination}
            onFindRoute={handleFindRoute}
            loading={loading}
          />

          {banner && <Banner variant={banner.variant}>{banner.text}</Banner>}

          {routes.length > 0 && (
            <>
              <p className="text-sm font-medium text-muted">ROUTE OPTIONS</p>
              {!selectedRoute && (
                <Banner variant="brand">Select a route below to preview it on the map.</Banner>
              )}
              {liveDataUnavailable && <Banner variant="warning">Live sensory data unavailable.</Banner>}
              {showNoQuieterAlternativeNote && (
                <Banner variant="brand">No suitable quieter alternative available.</Banner>
              )}
              <CongestionSummary route={selectedRoute} />
              <RouteCardList
                routes={routes}
                recommendedRouteId={recommendedRouteId}
                fastestRouteId={fastestRouteId}
                quieterAlternativeRouteId={quieterAlternativeRouteId}
                selectedRouteId={selectedRouteId}
                onSelect={setSelectedRouteId}
                onShowDetails={setModalRoute}
                onGetNavigation={setNavigationRoute}
              />
            </>
          )}
        </div>

        {routes.length > 0 && (
          <div className="flex w-full flex-col gap-5">
            <h2 className="text-xl font-semibold text-primary">Congestion Map</h2>
            <Banner variant="brand">
              Current pedestrian density is based on City of Melbourne live sensor data.
            </Banner>
            <MapView
              hasMapsKey={hasMapsKey}
              isLoaded={isLoaded}
              loadError={loadError}
              routes={routes}
              selectedRouteId={selectedRouteId}
              recommendedRouteId={recommendedRouteId}
              start={start}
              destination={destination}
            />
            <RouteSummary route={selectedRoute} {...statusIds} />
          </div>
        )}
      </div>

      <SensoryDetailsModal route={modalRoute} onClose={() => setModalRoute(null)} />
      <TurnByTurnModal route={navigationRoute} onClose={() => setNavigationRoute(null)} />
    </div>
  );
}
