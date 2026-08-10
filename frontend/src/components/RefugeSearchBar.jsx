import { useState } from "react";
import LocationField from "./LocationField";
import { isWithinMelbourne } from "../constants/melbourne";

const RADIUS_OPTIONS = [5, 10, 15, 20];
const SELECT_CLASS = "h-12 w-full rounded-lg border border-line bg-base px-4 py-3 text-sm text-primary";

export default function RefugeSearchBar({
  hasMapsKey,
  isLoaded,
  origin,
  onChangeOrigin,
  refugeType,
  onChangeRefugeType,
  walkingMinutes,
  onChangeWalkingMinutes,
  onFindRefuges,
  loading,
}) {
  const [geoError, setGeoError] = useState(null);

  // reads browser geolocation and sets it as the origin if within Melbourne
  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setGeoError("Location services aren't available in this browser. Please choose a location manually.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (!isWithinMelbourne(latitude, longitude)) {
          setGeoError("Your current location is outside the Melbourne CBD service area. Please choose a location manually.");
          return;
        }
        setGeoError(null);
        onChangeOrigin({ label: "My current location", latitude, longitude });
      },
      () => {
        setGeoError("Location permission denied. Please choose a location manually.");
      }
    );
  }

  const canFind = Boolean(origin) && !loading;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-base p-6">
      <div className="flex flex-col gap-1">
        <LocationField
          id="refuge-origin"
          labelText="Your Location"
          value={origin}
          onChange={onChangeOrigin}
          hasMapsKey={hasMapsKey}
          isLoaded={isLoaded}
        />
        <button type="button" onClick={useCurrentLocation} className="mt-1 w-fit cursor-pointer text-xs font-medium text-brand-ink hover:underline">
          Use my current location
        </button>
        {geoError && <p className="text-xs text-danger-ink">{geoError}</p>}
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <label htmlFor="refuge-type" className="text-sm font-medium text-primary">
            Refuge Type
          </label>
          <select
            id="refuge-type"
            value={refugeType}
            onChange={(event) => onChangeRefugeType(event.target.value)}
            className={SELECT_CLASS}
          >
            <option value="all">All</option>
            <option value="indoor">Indoor</option>
            <option value="outdoor">Outdoor</option>
          </select>
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <label htmlFor="refuge-radius" className="text-sm font-medium text-primary">
            Radius
          </label>
          <select
            id="refuge-radius"
            value={walkingMinutes}
            onChange={(event) => onChangeWalkingMinutes(Number(event.target.value))}
            className={SELECT_CLASS}
          >
            {RADIUS_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} min walk
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={onFindRefuges}
        disabled={!canFind}
        className="w-full cursor-pointer rounded-lg bg-brand py-3 text-sm font-semibold text-inverse hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Finding refuges…" : "Find Refuges"}
      </button>

      {!hasMapsKey && (
        <p className="text-xs text-muted">
          Address search needs a Google Maps API key — using the built-in Melbourne CBD location picker for now.
        </p>
      )}
    </div>
  );
}
