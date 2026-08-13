import { useState } from "react";
import RefugeSearchBar from "../components/RefugeSearchBar";
import RefugeCardList from "../components/RefugeCardList";
import RefugeMap from "../components/RefugeMap";
import RefugeDetailsModal from "../components/RefugeDetailsModal";
import MapView from "../components/MapView";
import RouteCardList from "../components/RouteCardList";
import RouteSummary from "../components/RouteSummary";
import SensoryDetailsModal from "../components/SensoryDetailsModal";
import TurnByTurnModal from "../components/TurnByTurnModal";
import Banner from "../components/Banner";
import InfoPopover from "../components/InfoPopover";
import { useGoogleMapsLoader } from "../hooks/useGoogleMapsLoader";
import { fetchNearbyRefuges } from "../services/refugesApi";
import { fetchRoutes, ApiRequestError } from "../services/routesApi";

export default function RefugeFinderPage() {
  const { hasMapsKey, isLoaded, loadError } = useGoogleMapsLoader();

  const [origin, setOrigin] = useState(null);
  const [refugeType, setRefugeType] = useState("all");
  const [walkingMinutes, setWalkingMinutes] = useState(10);
  const [refuges, setRefuges] = useState([]);
  const [selectedRefugeId, setSelectedRefugeId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [modalRefuge, setModalRefuge] = useState(null);

  // Directions sub-view
  const [mode, setMode] = useState("search"); // "search" | "directions"
  const [directions, setDirections] = useState(null);
  const [directionsLoading, setDirectionsLoading] = useState(false);
  const [navigationRoute, setNavigationRoute] = useState(null);
  const [modalRoute, setModalRoute] = useState(null);

  // searches for refuges near origin, stores results
  async function handleFindRefuges() {
    if (!origin) return;
    setLoading(true);
    setBanner(null);
    setSelectedRefugeId(null);
    setHasSearched(true);

    try {
      const data = await fetchNearbyRefuges({
        latitude: origin.latitude,
        longitude: origin.longitude,
        walkingMinutes,
      });
      setRefuges(data.refuges || []);
    } catch (error) {
      setRefuges([]);
      if (error instanceof ApiRequestError) {
        setBanner({ variant: "error", text: error.message });
      } else {
        setBanner({ variant: "error", text: "Unable to load refuges. Please try again." });
      }
    } finally {
      setLoading(false);
    }
  }

  // fetches a route to the refuge and switches into the directions sub-view
  async function handleGetDirections(refuge) {
    setDirectionsLoading(true);
    setBanner(null);

    // accessibleEntrance is always null today - falls back to refuge coords.
    const destinationPoint = refuge.accessibleEntrance || { latitude: refuge.latitude, longitude: refuge.longitude };

    try {
      const data = await fetchRoutes({
        start: { latitude: origin.latitude, longitude: origin.longitude },
        destination: { latitude: destinationPoint.latitude, longitude: destinationPoint.longitude },
      });
      const fetchedRoutes = data.routes || [];

      if (fetchedRoutes.length === 0) {
        setBanner({ variant: "warning", text: "Unable to generate directions to this refuge." });
      } else if (fetchedRoutes.every((route) => route.dataState === "unavailable")) {
        setBanner({ variant: "warning", text: "Live sensory data unavailable." });
      }

      setDirections({
        routes: fetchedRoutes,
        recommendedRouteId: data.recommendedRouteId,
        fastestRouteId: data.fastestRouteId || null,
        quieterAlternativeRouteId: data.quieterAlternativeRouteId || null,
        selectedRouteId: null, // nothing selected until the user picks a card
        destinationRefuge: refuge,
        destinationPoint,
      });
      setMode("directions");
      setModalRefuge(null);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setBanner({ variant: "error", text: error.message });
      } else {
        setBanner({ variant: "error", text: "Unable to generate directions to this refuge." });
      }
    } finally {
      setDirectionsLoading(false);
    }
  }

  // updates just the selected route inside the directions state
  function handleSelectDirectionsRoute(routeId) {
    setDirections((prev) => (prev ? { ...prev, selectedRouteId: routeId } : prev));
  }

  // leaves the directions sub-view, back to the refuge's details modal
  function handleBack() {
    setMode("search");
    setBanner(null);
    if (directions?.destinationRefuge) {
      setModalRefuge(directions.destinationRefuge);
    }
    setDirections(null);
  }

  const visibleRefuges = refuges.filter((refuge) => refugeType === "all" || refuge.indoorOutdoor === refugeType);
  const directionsRoute = directions?.routes.find((route) => route.routeId === directions.selectedRouteId) || null;
  const directionsFastestRoute =
    directions?.routes.find((route) => route.routeId === directions.fastestRouteId) || null;

  // Suppressed when the search-level banner already shows this same message.
  const directionsLiveDataUnavailable =
    directionsRoute?.dataState === "unavailable" && banner?.text !== "Live sensory data unavailable.";
  const directionsShowNoQuieterAlternativeNote =
    Boolean(directions) &&
    !directionsLiveDataUnavailable &&
    !directions.quieterAlternativeRouteId &&
    Boolean(directionsFastestRoute) &&
    directionsFastestRoute.highCrowdDistanceMetres > 0;

  // contextual help/status messages, consolidated into one "i" popup instead of stacked banners
  const directionsInfoItems = [
    "Current pedestrian density is based on City of Melbourne live sensor data.",
    ...(directions?.routes.length > 0 && !directionsRoute ? ["Select a route below to preview it on the map."] : []),
    ...(directionsShowNoQuieterAlternativeNote ? ["No suitable quieter alternative available."] : []),
  ];

  // directions sub-view: same route-picking UI as HomePage, scoped to one refuge
  if (mode === "directions" && directions) {
    return (
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8 px-16 py-8">
        <div className="flex flex-col gap-2">
          <button type="button" onClick={handleBack} className="w-fit cursor-pointer text-sm font-medium text-brand-ink hover:underline">
            ← Back to refuge details
          </button>
          <h1 className="text-3xl font-semibold text-primary">
            Directions to {directions.destinationRefuge.name}
          </h1>
          <p className="text-base text-secondary">The lowest-sensory walking route to this refuge.</p>
        </div>

        {banner && <Banner variant={banner.variant}>{banner.text}</Banner>}

        {directions.routes.length > 0 && (
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
            {/* left column: scrollable route cards */}
            <div className="flex w-full flex-col gap-5 lg:w-[540px] lg:shrink-0">
              <p className="text-sm font-medium text-muted">ROUTE OPTIONS</p>
              {directionsLiveDataUnavailable && (
                <Banner variant="warning">Live sensory data unavailable.</Banner>
              )}
              <div className="max-h-[560px] overflow-y-auto pr-1">
                <RouteCardList
                  routes={directions.routes}
                  recommendedRouteId={directions.recommendedRouteId}
                  fastestRouteId={directions.fastestRouteId}
                  quieterAlternativeRouteId={directions.quieterAlternativeRouteId}
                  selectedRouteId={directions.selectedRouteId}
                  onSelect={handleSelectDirectionsRoute}
                  onShowDetails={setModalRoute}
                  onGetNavigation={setNavigationRoute}
                />
              </div>
            </div>

            {/* right column: map + selected-route summary - fixed in place while the cards scroll */}
            <div className="sticky top-6 flex w-full flex-col gap-5">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-primary">Route Map</h2>
                <InfoPopover items={directionsInfoItems} />
              </div>
              <MapView
                hasMapsKey={hasMapsKey}
                isLoaded={isLoaded}
                loadError={loadError}
                routes={directions.routes}
                selectedRouteId={directions.selectedRouteId}
                recommendedRouteId={directions.recommendedRouteId}
                start={origin}
                destination={directions.destinationPoint}
              />
              <RouteSummary
                route={directionsRoute}
                recommendedRouteId={directions.recommendedRouteId}
                fastestRouteId={directions.fastestRouteId}
                quieterAlternativeRouteId={directions.quieterAlternativeRouteId}
              />
            </div>
          </div>
        )}

        <SensoryDetailsModal route={modalRoute} onClose={() => setModalRoute(null)} />
        <TurnByTurnModal route={navigationRoute} onClose={() => setNavigationRoute(null)} />
      </div>
    );
  }

  // search view: origin form + refuge list/map
  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-8 px-16 py-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-primary">Find Nearby Quiet Refuge Spaces</h1>
        <p className="text-base text-secondary">
          Locate nearby indoor and outdoor refuge spaces where you can take a break from sensory overload.
        </p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* left column: search form + refuge cards */}
        <div className="flex w-full flex-col gap-5 lg:w-[540px] lg:shrink-0">
          <RefugeSearchBar
            hasMapsKey={hasMapsKey}
            isLoaded={isLoaded}
            origin={origin}
            onChangeOrigin={setOrigin}
            refugeType={refugeType}
            onChangeRefugeType={setRefugeType}
            walkingMinutes={walkingMinutes}
            onChangeWalkingMinutes={setWalkingMinutes}
            onFindRefuges={handleFindRefuges}
            loading={loading}
          />

          {banner && <Banner variant={banner.variant}>{banner.text}</Banner>}

          {!banner && !loading && hasSearched && visibleRefuges.length === 0 && (
            <Banner variant="warning">No nearby sensory refuges found.</Banner>
          )}

          {visibleRefuges.length > 0 && (
            <>
              <p className="text-sm font-medium text-muted">REFUGES NEARBY</p>
              <RefugeCardList
                refuges={visibleRefuges}
                selectedRefugeId={selectedRefugeId}
                onSelect={setSelectedRefugeId}
                onViewDetails={setModalRefuge}
              />
            </>
          )}
        </div>

        {/* right column: map */}
        {visibleRefuges.length > 0 && (
          <div className="flex w-full flex-col gap-5">
            <h2 className="text-xl font-semibold text-primary">Refuge Map</h2>
            <RefugeMap
              hasMapsKey={hasMapsKey}
              isLoaded={isLoaded}
              loadError={loadError}
              origin={origin}
              refuges={visibleRefuges}
              selectedRefugeId={selectedRefugeId}
              onSelect={setSelectedRefugeId}
            />
          </div>
        )}
      </div>

      <RefugeDetailsModal
        refuge={modalRefuge}
        onClose={() => setModalRefuge(null)}
        onGetDirections={handleGetDirections}
      />

      {directionsLoading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20">
          <div className="rounded-lg bg-base px-6 py-4 text-sm font-medium text-primary shadow-panel">
            Finding the calmest route…
          </div>
        </div>
      )}
    </div>
  );
}
