import { useRef, useState } from "react";
import LocationField from "./LocationField";
import { isWithinMelbourne } from "../constants/melbourne";

export default function SearchBar({
  hasMapsKey,
  isLoaded,
  start,
  destination,
  onChangeStart,
  onChangeDestination,
  onFindRoute,
  loading,
}) {
  const [geoError, setGeoError] = useState(null);
  const startFieldRef = useRef(null);
  const destinationFieldRef = useRef(null);

  // reads browser geolocation and sets it as the start point if within Melbourne
  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setGeoError("Location services aren't available in this browser. Please choose a start point manually.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (!isWithinMelbourne(latitude, longitude)) {
          setGeoError(
            "Your current location is outside the Melbourne CBD service area. Please choose a start point manually."
          );
          return;
        }
        setGeoError(null);
        onChangeStart({ label: "My current location", latitude, longitude });
      },
      () => {
        setGeoError("Location permission denied. Please choose a start point manually.");
      }
    );
  }

  // validates both fields first; only calls onFindRoute if both are OK
  function handleFindRouteClick() {
    const startError = startFieldRef.current?.validate();
    const destinationError = destinationFieldRef.current?.validate();
    if (startError || destinationError) return;
    onFindRoute();
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-line bg-base p-6">
      <div className="flex flex-col gap-1">
        <LocationField
          ref={startFieldRef}
          id="start-location"
          labelText="Start Location"
          value={start}
          onChange={onChangeStart}
          hasMapsKey={hasMapsKey}
          isLoaded={isLoaded}
        />
        <button type="button" onClick={useCurrentLocation} className="mt-1 w-fit cursor-pointer text-xs font-medium text-brand-ink hover:underline">
          Use my current location
        </button>
        {geoError && <p className="text-xs text-danger-ink">{geoError}</p>}
      </div>

      <LocationField
        ref={destinationFieldRef}
        id="destination-location"
        labelText="Destination"
        value={destination}
        onChange={onChangeDestination}
        hasMapsKey={hasMapsKey}
        isLoaded={isLoaded}
      />

      <button
        type="button"
        onClick={handleFindRouteClick}
        disabled={loading}
        className="w-full cursor-pointer rounded-lg bg-brand py-3 text-sm font-semibold text-inverse hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Finding route…" : "Find Route"}
      </button>

      {!hasMapsKey && (
        <p className="text-xs text-muted">
          Address search needs a Google Maps API key — using the built-in Melbourne CBD location picker for now.
        </p>
      )}
    </div>
  );
}
