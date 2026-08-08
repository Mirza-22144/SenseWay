import { useRef, useState } from "react";
import { Autocomplete } from "@react-google-maps/api";
import { MELBOURNE_BOUNDS, isWithinMelbourne } from "../constants/melbourne";
import { MELBOURNE_PLACES } from "../data/mockPlaces";

const FIELD_CLASS = "h-[50px] w-full rounded-lg border border-line bg-base px-4 py-3 text-sm text-primary";

// A location field. Renders real Google Places Autocomplete (Melbourne-bounded)
// once a Maps API key is configured; otherwise falls back to a picker over
// well-known CBD landmarks so the flow works with zero setup. Shared by
// SearchBar (Story 1.1) and RefugeSearchBar (Story 2.1).
export default function LocationField({ id, labelText, value, onChange, hasMapsKey, isLoaded }) {
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
