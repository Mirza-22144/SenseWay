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

  // calls the backend, stores the returned routes, and sets the right banner
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
      setSelectedRouteId(null); // nothing selected until the user picks a card

      // no routes / no live data -> tell the user why the list looks the way it does
      if (fetchedRoutes.length === 0) {
        setBanner({ variant: "warning", text: "No routes available for these locations." });
      } else if (fetchedRoutes.every((route) => route.dataState === "unavailable")) {
        setBanner({ variant: "warning", text: "Live sensory data unavailable." });
      }
    } catch (error) {
      // request failed - clear any previous results and show why
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

  // per-route banner - suppressed when the search-level banner already shows this same message
  const liveDataUnavailable =
    selectedRoute?.dataState === "unavailable" && banner?.text !== "Live sensory data unavailable.";
  // recommended route is busy but no calmer option was found within the time budget
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
        {/* left column: search form, banners, route cards */}
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

        {/* right column: map + selected-route summary */}
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
