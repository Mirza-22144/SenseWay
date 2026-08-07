import { useRef, useState } from "react";
import { Autocomplete } from "@react-google-maps/api";
import { MELBOURNE_BOUNDS, isWithinMelbourne } from "../constants/melbourne";
import { MELBOURNE_PLACES } from "../data/mockPlaces";

const FIELD_CLASS = "h-[50px] w-full rounded-lg border border-line bg-base px-4 py-3 text-sm text-primary";

// A start/destination field. Renders real Google Places Autocomplete
// (Melbourne-bounded) once a Maps API key is configured; otherwise falls back
// to a picker over well-known CBD landmarks so the flow works with zero setup.
function LocationField({ id, labelText, value, onChange, hasMapsKey, isLoaded }) {
  const autocompleteRef = useRef(null);
  const [error, setError] = useState(null);

  function handlePlaceChanged() {
    const place = autocompleteRef.current?.getPlace();
    const location = place?.geometry?.location;
    if (!location) {
      setError("Please choose a location from the suggestions.");
      return;
    }
    const latitude = location.lat();
    const longitude = location.lng();
    if (!isWithinMelbourne(latitude, longitude)) {
      setError("Please enter a valid Melbourne CBD location.");
      onChange(null);
      return;
    }
    setError(null);
    onChange({ label: place.formatted_address || place.name, latitude, longitude });
  }

  if (hasMapsKey && isLoaded) {
    const bounds = {
      north: MELBOURNE_BOUNDS.latMax,
      south: MELBOURNE_BOUNDS.latMin,
      east: MELBOURNE_BOUNDS.lonMax,
      west: MELBOURNE_BOUNDS.lonMin,
    };
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={id} className="text-sm font-medium text-primary">
          {labelText}
        </label>
        <Autocomplete
          onLoad={(autocomplete) => {
            autocompleteRef.current = autocomplete;
          }}
          onPlaceChanged={handlePlaceChanged}
          bounds={bounds}
          options={{ strictBounds: false }}
        >
          <input
            id={id}
            type="text"
            placeholder="Search a Melbourne CBD address"
            defaultValue={value?.label || ""}
            className={FIELD_CLASS}
          />
        </Autocomplete>
        {error && <p className="text-xs text-danger-ink">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-primary">
        {labelText}
      </label>
      <select
        id={id}
        value={value?.label || ""}
        onChange={(event) => {
          const place = MELBOURNE_PLACES.find((p) => p.name === event.target.value);
          onChange(
            place ? { label: place.name, latitude: place.latitude, longitude: place.longitude } : null
          );
        }}
        className={FIELD_CLASS}
      >
        <option value="">Select a location…</option>
        {value && !MELBOURNE_PLACES.some((p) => p.name === value.label) && (
          <option value={value.label}>{value.label}</option>
        )}
        {MELBOURNE_PLACES.map((place) => (
          <option key={place.name} value={place.name}>
            {place.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// AC 1.1.1: start/destination search + Find Route button. Matches the Figma
// "Search" card (node 71:1018): fields stacked vertically inside a white card.
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

  const canFindRoute = Boolean(start && destination) && !loading;

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-line bg-base p-6">
      <div className="flex flex-col gap-1">
        <LocationField
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
        id="destination-location"
        labelText="Destination"
        value={destination}
        onChange={onChangeDestination}
        hasMapsKey={hasMapsKey}
        isLoaded={isLoaded}
      />

      <button
        type="button"
        onClick={onFindRoute}
        disabled={!canFindRoute}
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
