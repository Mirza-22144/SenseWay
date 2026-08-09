import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { MELBOURNE_BOUNDS, isWithinMelbourne } from "../constants/melbourne";

const FIELD_CLASS = "h-[50px] w-full rounded-lg border border-line bg-base px-4 py-3 text-sm text-primary";

// Location field backed by Google's PlaceAutocompleteElement. Shared by
// SearchBar and RefugeSearchBar. Exposes validate() via ref for the
// missing-field / invalid-location prompts.
const LocationField = forwardRef(function LocationField(
  { id, labelText, value, onChange, hasMapsKey, isLoaded },
  ref
) {
  const containerRef = useRef(null);
  const rawTextRef = useRef("");
  const [error, setError] = useState(null);

  // exposed to parent via ref - checks field state and sets the right error
  useImperativeHandle(
    ref,
    () => ({
      validate() {
        if (value) {
          setError(null);
          return null;
        }
        // field is empty
        const raw = rawTextRef.current.trim();
        if (!raw) {
          const message = `Please enter a ${labelText.toLowerCase()}.`;
          setError(message);
          return message;
        }
        // field has text but no valid place was selected
        const message = "Please enter a valid Melbourne CBD location.";
        setError(message);
        return message;
      },
    }),
    [value, labelText]
  );

  // create and mount the Google autocomplete widget once maps + container are ready
  useEffect(() => {
    if (!hasMapsKey || !isLoaded || !containerRef.current) return undefined;
    if (!window.google?.maps?.places?.PlaceAutocompleteElement) return undefined;

    // Bias, not a restriction - out-of-area entries are still accepted here
    // and rejected by the validation below, not silently hidden.
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
    // Forces the light theme; otherwise the dropdown ignores the page's
    // color-scheme and renders dark/low-contrast on a dark OS/browser theme.
    autocomplete.style.setProperty("color-scheme", "light");

    // track raw typed text so validate() can tell "empty" from "typed but not selected"
    function handleInput(event) {
      const target = event.composedPath ? event.composedPath()[0] : event.target;
      rawTextRef.current = target?.value ?? "";
      setError(null);
    }

    // user picked a suggestion - resolve it to coordinates and validate the area
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

    // cleanup on unmount / re-run
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
