import { useRef, useState } from "react";
import { Autocomplete } from "@react-google-maps/api";
import { MELBOURNE_BOUNDS, isWithinMelbourne } from "../constants/melbourne";
import { MELBOURNE_PLACES } from "../data/mockPlaces";

const FIELD_CLASS = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

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
      <div>
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
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
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
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

// AC 1.1.1: start/destination search + Find Route button.
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
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <LocationField
            id="start-location"
            labelText="Start location"
            value={start}
            onChange={onChangeStart}
            hasMapsKey={hasMapsKey}
            isLoaded={isLoaded}
          />
          <button
            type="button"
            onClick={useCurrentLocation}
            className="mt-1 text-xs font-medium text-violet-700 hover:underline"
          >
            Use my current location
          </button>
          {geoError && <p className="mt-1 text-xs text-rose-600">{geoError}</p>}
        </div>

        <LocationField
          id="destination-location"
          labelText="Destination"
          value={destination}
          onChange={onChangeDestination}
          hasMapsKey={hasMapsKey}
          isLoaded={isLoaded}
        />
      </div>

      <button
        type="button"
        onClick={onFindRoute}
        disabled={!canFindRoute}
        className="mt-4 w-full rounded-lg bg-violet-600 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {loading ? "Finding route…" : "Find Route"}
      </button>

      {!hasMapsKey && (
        <p className="mt-2 text-xs text-slate-400">
          Address search needs a Google Maps API key — using the built-in Melbourne CBD location picker for now.
        </p>
      )}
    </div>
  );
}
