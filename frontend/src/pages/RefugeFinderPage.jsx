import { useState } from "react";
import RefugeSearchBar from "../components/RefugeSearchBar";
import RefugeCardList from "../components/RefugeCardList";
import RefugeMap from "../components/RefugeMap";
import RefugeDetailsModal from "../components/RefugeDetailsModal";
import MapView from "../components/MapView";
import RouteSummary from "../components/RouteSummary";
import Banner from "../components/Banner";
import { useGoogleMapsLoader } from "../hooks/useGoogleMapsLoader";
import { fetchNearbyRefuges } from "../services/refugesApi";
import { fetchRoutes, ApiRequestError } from "../services/routesApi";

// User Story 2.1 (Sensory Refuge Location Finder): AC 2.1.1 search/list/map,
// AC 2.1.2 details modal, AC 2.1.3 directions sub-view. Layout matches the
// Figma "Find Nearby Quiet Refuge Spaces" frame (node 40:216).
export default function RefugeFinderPage() {
  const { hasMapsKey, isLoaded, loadError } = useGoogleMapsLoader();

  const [origin, setOrigin] = useState(null);
  const [refugeType, setRefugeType] = useState("all");
  const [walkingMinutes, setWalkingMinutes] = useState(10);
  const [refuges, setRefuges] = useState([]);
  const [selectedRefugeId, setSelectedRefugeId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(null);
  const [modalRefuge, setModalRefuge] = useState(null);

  // Directions sub-view (AC 2.1.3)
  const [mode, setMode] = useState("search"); // "search" | "directions"
  const [directions, setDirections] = useState(null); // { routes, recommendedRouteId, fastestRouteId, quieterAlternativeRouteId, selectedRouteId, destinationRefuge }
  const [directionsLoading, setDirectionsLoading] = useState(false);

  async function handleFindRefuges() {
    if (!origin) return;
    setLoading(true);
    setBanner(null);
    setSelectedRefugeId(null);

    try {
      const data = await fetchNearbyRefuges({
        latitude: origin.latitude,
        longitude: origin.longitude,
        walkingMinutes,
      });
      const fetchedRefuges = data.refuges || [];
      setRefuges(fetchedRefuges);
      if (fetchedRefuges.length === 0) {
        setBanner({ variant: "warning", text: "No nearby sensory refuges found." });
      }
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

  async function handleGetDirections(refuge) {
    setDirectionsLoading(true);
    setBanner(null);

    // AC 2.1.3: "If the refuge is inside a larger complex, display the pin at
    // the accessible entrance" — accessibleEntrance is always null today (no
    // such data exists yet), so this falls back to the refuge's own
    // coordinates, but will route to the entrance once that field is populated.
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
        selectedRouteId: data.recommendedRouteId || fetchedRoutes[0]?.routeId || null,
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
          <div className="flex flex-col gap-5">
            <MapView
              hasMapsKey={hasMapsKey}
              isLoaded={isLoaded}
              loadError={loadError}
              routes={directions.routes}
              selectedRouteId={directions.selectedRouteId}
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
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-8 px-16 py-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-primary">Find Nearby Quiet Refuge Spaces</h1>
        <p className="text-base text-secondary">
          Locate nearby indoor and outdoor refuge spaces where you can take a break from sensory overload.
        </p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
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
