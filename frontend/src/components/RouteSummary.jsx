import SensoryBadge from "./SensoryBadge";
import { formatDistance, formatDuration } from "../utils/format";

// AC 1.1.3: refreshes when the user picks a different route card.
// AC 1.2.2: plain-language congestion exposure line.
function congestionText(route) {
  if (route.dataState === "unavailable") return "Live congestion data unavailable.";
  if (!route.highCrowdDistanceMetres) return "No high-crowd areas on this route.";
  return `${formatDistance(route.highCrowdDistanceMetres)} through high-crowd areas`;
}

export default function RouteSummary({ route }) {
  if (!route) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{route.summary}</p>
          <p className="text-lg font-semibold text-slate-900">
            {formatDuration(route.durationMinutes)} · {formatDistance(route.distanceMetres)}
          </p>
        </div>
        <SensoryBadge rating={route.sensoryRating} />
      </div>
      <p className="mt-2 text-sm text-slate-500">{congestionText(route)}</p>
    </div>
  );
}
