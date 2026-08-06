import { useState } from "react";
import SearchBar from "../components/SearchBar";
import MapView from "../components/MapView";
import RouteCardList from "../components/RouteCardList";
import RouteSummary from "../components/RouteSummary";
import SensoryDetailsModal from "../components/SensoryDetailsModal";
import Banner from "../components/Banner";
import { useGoogleMapsLoader } from "../hooks/useGoogleMapsLoader";
import { fetchRoutes, ApiRequestError } from "../services/routesApi";

// Owns all state for User Stories 1.1 (search -> sensory-coded route options ->
// select an alternative -> view sensory rating details) and 1.2 (congestion
// shading, congestion summary, quieter alternative).
export default function HomePage() {
  const { hasMapsKey, isLoaded, loadError } = useGoogleMapsLoader();

  const [start, setStart] = useState(null);
  const [destination, setDestination] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [recommendedRouteId, setRecommendedRouteId] = useState(null);
  const [quieterAlternativeRouteId, setQuieterAlternativeRouteId] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(null);
  const [modalRoute, setModalRoute] = useState(null);

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
      setQuieterAlternativeRouteId(data.quieterAlternativeRouteId || null);
      setSelectedRouteId(data.recommendedRouteId || fetchedRoutes[0]?.routeId || null);

      if (fetchedRoutes.length === 0) {
        setBanner({ variant: "warning", text: "No routes available for these locations." });
      } else if (fetchedRoutes.every((route) => route.dataState === "unavailable")) {
        setBanner({ variant: "warning", text: "Live sensory data unavailable." });
      }
    } catch (error) {
      setRoutes([]);
      setRecommendedRouteId(null);
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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4">
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
          <MapView
            hasMapsKey={hasMapsKey}
            isLoaded={isLoaded}
            loadError={loadError}
            routes={routes}
            selectedRouteId={selectedRouteId}
            start={start}
            destination={destination}
          />
          <RouteSummary route={selectedRoute} />
          <RouteCardList
            routes={routes}
            recommendedRouteId={recommendedRouteId}
            quieterAlternativeRouteId={quieterAlternativeRouteId}
            selectedRouteId={selectedRouteId}
            onSelect={setSelectedRouteId}
            onShowDetails={setModalRoute}
          />
        </>
      )}

      <SensoryDetailsModal route={modalRoute} onClose={() => setModalRoute(null)} />
    </div>
  );
}
