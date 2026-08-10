import { GoogleMap, Marker } from "@react-google-maps/api";

const MAP_CONTAINER_STYLE = { width: "100%", height: "460px", borderRadius: "12px" };
const DEFAULT_CENTER = { lat: -37.8136, lng: 144.9631 };

// pin colour by indoor/outdoor, bigger + highlighted when selected
function refugeIconFor(refuge, isSelected) {
  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    scale: isSelected ? 9 : 7,
    fillColor: refuge.indoorOutdoor === "outdoor" ? "#2e7050" : "#171b24",
    fillOpacity: 1,
    strokeColor: isSelected ? "#2e5aac" : "#ffffff",
    strokeWeight: isSelected ? 3 : 1.5,
  };
}

// blue pin marking the user's search origin
const ORIGIN_ICON = () => ({
  path: window.google.maps.SymbolPath.CIRCLE,
  scale: 8,
  fillColor: "#2e5aac",
  fillOpacity: 1,
  strokeColor: "#ffffff",
  strokeWeight: 2,
});

export default function RefugeMap({ hasMapsKey, isLoaded, loadError, origin, refuges, selectedRefugeId, onSelect }) {
  if (!hasMapsKey) {
    return (
      <div className="flex h-[460px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-line bg-base p-6 text-center">
        <p className="text-sm font-medium text-secondary">Map preview needs a Google Maps API key</p>
        <p className="mt-1 max-w-sm text-xs text-muted">
          Add VITE_GOOGLE_MAPS_API_KEY in frontend/.env to see refuges plotted on a live map. Refuge
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

  const center = origin ? { lat: origin.latitude, lng: origin.longitude } : DEFAULT_CENTER;

  return (
    <div>
      <div className="relative">
        <GoogleMap mapContainerStyle={MAP_CONTAINER_STYLE} center={center} zoom={15}>
          {origin && <Marker position={{ lat: origin.latitude, lng: origin.longitude }} icon={ORIGIN_ICON()} title="Your location" />}
          {refuges.map((refuge) => (
            <Marker
              key={refuge.refugeId}
              position={{ lat: refuge.latitude, lng: refuge.longitude }}
              icon={refugeIconFor(refuge, refuge.refugeId === selectedRefugeId)}
              title={refuge.name}
              onClick={() => onSelect(refuge.refugeId)}
            />
          ))}
        </GoogleMap>

        <div className="absolute right-4 top-4 flex flex-col gap-3 rounded-lg border border-line bg-base p-4 shadow-panel">
          <p className="text-xs font-medium text-primary">Map key</p>
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-brand" aria-hidden="true" />
            <span className="text-xs text-secondary">Your location</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-[#171b24]" aria-hidden="true" />
            <span className="text-xs text-secondary">Indoor refuge</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-success" aria-hidden="true" />
            <span className="text-xs text-secondary">Outdoor refuge</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full border-2 border-brand bg-base" aria-hidden="true" />
            <span className="text-xs text-secondary">Selected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
