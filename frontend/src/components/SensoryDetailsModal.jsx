import { useEffect } from "react";
import SensoryBadge from "./SensoryBadge";
import { formatTimestamp } from "../utils/format";

// AC 1.1.2: sensory rating, contributing data, and last-updated time for a
// route, opened from a route card's sensory badge.
export default function SensoryDetailsModal({ route, onClose }) {
  useEffect(() => {
    if (!route) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [route, onClose]);

  if (!route) return null;

  const sensorsUsed = route.contributingFactors?.sensorsUsed || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sensory rating details"
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Sensory rating details</h2>
          <SensoryBadge rating={route.sensoryRating} />
        </div>

        <p className="mt-3 text-sm text-slate-600">{route.ratingReason}</p>

        {route.dataState === "unavailable" && (
          <p className="mt-2 text-sm font-medium text-rose-600">
            Detailed sensory data unavailable for this route.
          </p>
        )}
        {route.dataState === "stale" && (
          <p className="mt-2 text-sm font-medium text-amber-600">
            Sensory data may be outdated.
          </p>
        )}

        {sensorsUsed.length > 0 && (
          <ul className="mt-3 list-inside list-disc text-sm text-slate-500">
            {sensorsUsed.map((sensor) => (
              <li key={sensor.sensorId}>{sensor.name}</li>
            ))}
          </ul>
        )}

        <p className="mt-4 text-xs text-slate-400">
          Data last updated: {formatTimestamp(route.dataUpdatedAt)}
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-lg bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Close
        </button>
      </div>
    </div>
  );
}
