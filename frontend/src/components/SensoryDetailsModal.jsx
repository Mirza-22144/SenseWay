import { useEffect } from "react";
import SensoryBadge from "./SensoryBadge";
import { formatTimestamp } from "../utils/format";

function densitySentence(route) {
  if (route.dataState === "unavailable") {
    return "Detailed sensory data unavailable for this route.";
  }
  const avg = route.contributingFactors?.pedestrianDensity?.averageCountPerHour;
  if (typeof avg === "number") {
    return `Live pedestrian density indicates an average of ${avg} people per hour along this route.`;
  }
  return "Live pedestrian density data contributes to this rating.";
}

// AC 1.1.2: sensory rating, contributing data, and last-updated time for a
// route, opened from a route card's sensory chip. Structure matches the Figma
// "Sensory Details Modal" (node 44:1983): labeled SENSORY RATING / REASON /
// CONTRIBUTING PEDESTRIAN DENSITY / LAST UPDATED sections.
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sensory rating details"
        className="flex w-full max-w-md flex-col gap-5 rounded-xl border border-line bg-base p-8 shadow-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-primary">Sensory Rating Details</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="cursor-pointer text-sm font-medium text-muted">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted">SENSORY RATING</p>
          <SensoryBadge rating={route.sensoryRating} variant="text" />
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted">REASON</p>
          <p className="text-sm text-secondary">{route.ratingReason}</p>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted">CONTRIBUTING PEDESTRIAN DENSITY</p>
          <p className="text-sm text-secondary">{densitySentence(route)}</p>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted">LAST UPDATED</p>
          <p className="text-sm text-secondary">
            Updated {formatTimestamp(route.dataUpdatedAt)}
            {route.dataState === "stale" && " · Sensory data may be outdated."}
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-inverse hover:brightness-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
