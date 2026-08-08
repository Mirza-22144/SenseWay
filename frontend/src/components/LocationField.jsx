import { useEffect, useRef, useState } from "react";
import { MELBOURNE_BOUNDS, isWithinMelbourne } from "../constants/melbourne";
import { MELBOURNE_PLACES } from "../data/mockPlaces";

const FIELD_CLASS = "h-[50px] w-full rounded-lg border border-line bg-base px-4 py-3 text-sm text-primary";

// A location field. Renders Google's PlaceAutocompleteElement (the "Places
// API (New)" web component — the legacy <Autocomplete> widget needs the old
// Places API, which this project's key deliberately does not allow) once a
// Maps API key is configured; otherwise falls back to a picker over
// well-known CBD landmarks so the flow works with zero setup. Shared by
// SearchBar (Story 1.1) and RefugeSearchBar (Story 2.1).
export default function LocationField({ id, labelText, value, onChange, hasMapsKey, isLoaded }) {
  const containerRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!hasMapsKey || !isLoaded || !containerRef.current) return undefined;
    if (!window.google?.maps?.places?.PlaceAutocompleteElement) return undefined;

    const autocomplete = new window.google.maps.places.PlaceAutocompleteElement({
      locationRestriction: {
        north: MELBOURNE_BOUNDS.latMax,
        south: MELBOURNE_BOUNDS.latMin,
        east: MELBOURNE_BOUNDS.lonMax,
        west: MELBOURNE_BOUNDS.lonMin,
      },
    });
    autocomplete.id = id;
    autocomplete.className = FIELD_CLASS;
    autocomplete.setAttribute("placeholder", "Search a Melbourne CBD address");

    async function handleSelect({ placePrediction }) {
      try {
        const place = placePrediction.toPlace();
        await place.fetchFields({ fields: ["location", "formattedAddress", "displayName"] });
        const latitude = place.location.lat();
        const longitude = place.location.lng();
        if (!isWithinMelbourne(latitude, longitude)) {
          setError("Please enter a valid Melbourne CBD location.");
          onChange(null);
          return;
        }
        setError(null);
        onChange({ label: place.formattedAddress || place.displayName, latitude, longitude });
      } catch {
        setError("Please choose a location from the suggestions.");
      }
    }

    autocomplete.addEventListener("gmp-select", handleSelect);
    containerRef.current.appendChild(autocomplete);

    return () => {
      autocomplete.removeEventListener("gmp-select", handleSelect);
      autocomplete.remove();
    };
  }, [hasMapsKey, isLoaded, id, onChange]);

  if (hasMapsKey && isLoaded) {
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={id} className="text-sm font-medium text-primary">
          {labelText}
        </label>
        <div ref={containerRef} />
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
