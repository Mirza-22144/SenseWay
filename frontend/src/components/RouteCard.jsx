import SensoryBadge from "./SensoryBadge";
import { formatDistance, formatDuration } from "../utils/format";
import { routeStatusLabel } from "../utils/routeStatus";

const BADGE_CLASS = {
  Recommended: "bg-success text-inverse",
  Alternative: "bg-subtle text-secondary",
  Fastest: "bg-subtle text-secondary",
};

function statusBadge(route, ids) {
  const text = routeStatusLabel(route, ids);
  // The quieter alternative gets the same label text ("Alternative") as a
  // plain non-recommended route, but highlighted green like Recommended.
  const isQuieterAlternative = text === "Alternative" && route.routeId === ids.quieterAlternativeRouteId;
  return { text, className: isQuieterAlternative ? "bg-success text-inverse" : BADGE_CLASS[text] };
}

// AC 1.1.1 (colour-coded route options) + AC 1.1.3 (select an alternative
// route, via the "View Route" button) + AC 1.2.3 (quieter-alternative
// labeling). Matches the Figma "Route Card" component structure: status
// badge, title, sensory chip + reason, 3-column metrics, full-width button.
export default function RouteCard({
  route,
  isSelected,
  fastestRouteId,
  recommendedRouteId,
  quieterAlternativeRouteId,
  onSelect,
  onShowDetails,
}) {
  const dataUnavailable = route.dataState === "unavailable";
  const badge = statusBadge(route, { recommendedRouteId, fastestRouteId, quieterAlternativeRouteId });

  return (
    <div
      className={`flex w-full flex-col gap-5 rounded-xl border bg-base p-6 shadow-card ${
        isSelected ? "border-2 border-brand" : "border-line"
      }`}
    >
      <div className="flex flex-col gap-1.5">
        <span className={`inline-block w-fit rounded px-2 py-0.5 text-xs font-medium ${badge.className}`}>
          {badge.text.toUpperCase()}
        </span>
        <p className="text-lg font-semibold text-primary">{route.summary}</p>
      </div>

      {dataUnavailable ? (
        <button
          type="button"
          onClick={() => onShowDetails(route)}
          className="w-fit cursor-pointer rounded-full bg-subtle px-3 py-1 text-xs font-medium text-muted"
        >
          Sensory data unavailable
        </button>
      ) : (
        <div>
          <SensoryBadge rating={route.sensoryRating} showSuffix onClick={() => onShowDetails(route)} />
          <p className="mt-2 text-xs text-secondary">{route.ratingReason}</p>
        </div>
      )}

      <div className="flex gap-6">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted">DISTANCE</p>
          <p className="text-lg font-semibold text-primary">{formatDistance(route.distanceMetres)}</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted">WALK</p>
          <p className="text-lg font-semibold text-primary">{formatDuration(route.durationMinutes)}</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted">SENSORY</p>
          <p className="text-lg font-semibold text-primary">{route.sensoryRating}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onSelect(route.routeId)}
        aria-pressed={isSelected}
        className="w-full cursor-pointer rounded-lg bg-brand py-3 text-sm font-semibold text-inverse hover:brightness-95"
      >
        View Route
      </button>
    </div>
  );
}
