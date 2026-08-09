import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { MELBOURNE_BOUNDS, isWithinMelbourne } from "../constants/melbourne";

const FIELD_CLASS = "h-[50px] w-full rounded-lg border border-line bg-base px-4 py-3 text-sm text-primary";

// A location field, backed by Google's PlaceAutocompleteElement (the "Places
// API (New)" web component — the legacy <Autocomplete> widget needs the old
// Places API, which this project's key deliberately does not allow). Shared
// by SearchBar (Story 1.1) and RefugeSearchBar (Story 2.1). Requires
// VITE_GOOGLE_MAPS_API_KEY to be set — see frontend/.env.example.
//
// Exposes validate() via ref so callers can prompt for a missing/invalid
// value on submit (AC: "The application prompts for the missing field" /
// "Please enter a valid Melbourne CBD location" is displayed).
const LocationField = forwardRef(function LocationField(
  { id, labelText, value, onChange, hasMapsKey, isLoaded },
  ref
) {
  const containerRef = useRef(null);
  const rawTextRef = useRef("");
  const [error, setError] = useState(null);

  useImperativeHandle(
    ref,
    () => ({
      validate() {
        if (value) {
          setError(null);
          return null;
        }
        const raw = rawTextRef.current.trim();
        if (!raw) {
          const message = `Please enter a ${labelText.toLowerCase()}.`;
          setError(message);
          return message;
        }
        const message = "Please enter a valid Melbourne CBD location.";
        setError(message);
        return message;
      },
    }),
    [value, labelText]
  );

  useEffect(() => {
    if (!hasMapsKey || !isLoaded || !containerRef.current) return undefined;
    if (!window.google?.maps?.places?.PlaceAutocompleteElement) return undefined;

    // A bias (not a hard restriction): suggestions favour the Melbourne CBD,
    // but any place the user types/selects is still accepted here and then
    // validated below, so an out-of-area entry surfaces our own message
    // instead of silently having no matching suggestions.
    const autocomplete = new window.google.maps.places.PlaceAutocompleteElement({
      locationBias: {
        north: MELBOURNE_BOUNDS.latMax,
        south: MELBOURNE_BOUNDS.latMin,
        east: MELBOURNE_BOUNDS.lonMax,
        west: MELBOURNE_BOUNDS.lonMin,
      },
    });
    autocomplete.id = id;
    autocomplete.className = FIELD_CLASS;
    autocomplete.setAttribute("placeholder", "Search a Melbourne CBD address");
    // This app is light-themed only (no dark mode support). Without this,
    // gmp-place-autocomplete's own theme detection overrides the page's
    // `color-scheme: light` and renders its suggestion dropdown dark when
    // the user's OS/browser is in dark mode - low-contrast, hard to read.
    autocomplete.style.setProperty("color-scheme", "light");

    function handleInput(event) {
      const target = event.composedPath ? event.composedPath()[0] : event.target;
      rawTextRef.current = target?.value ?? "";
      setError(null);
    }

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

    autocomplete.addEventListener("input", handleInput);
    autocomplete.addEventListener("gmp-select", handleSelect);
    containerRef.current.appendChild(autocomplete);

    return () => {
      autocomplete.removeEventListener("input", handleInput);
      autocomplete.removeEventListener("gmp-select", handleSelect);
      autocomplete.remove();
    };
  }, [hasMapsKey, isLoaded, id, onChange]);

  if (!hasMapsKey) {
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={id} className="text-sm font-medium text-primary">
          {labelText}
        </label>
        <div className={`${FIELD_CLASS} flex items-center text-muted`}>
          Set VITE_GOOGLE_MAPS_API_KEY in frontend/.env to search
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-primary">
        {labelText}
      </label>
      {isLoaded ? (
        <div ref={containerRef} />
      ) : (
        <div className={`${FIELD_CLASS} flex items-center text-muted`}>Loading…</div>
      )}
      {error && <p className="text-xs text-danger-ink">{error}</p>}
    </div>
  );
});

export default LocationField;
