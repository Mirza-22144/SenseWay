import SensoryBadge from "./SensoryBadge";
import { formatDistance, formatDuration } from "../utils/format";

// Minimal summary for the currently selected route (AC 1.1.3: refreshes when
// the user picks a different route card). The high-crowd-distance breakdown is
// Story 1.2, not here.
export default function RouteSummary({ route }) {
  if (!route) return null;

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <p className="text-sm text-slate-500">{route.summary}</p>
        <p className="text-lg font-semibold text-slate-900">
          {formatDuration(route.durationMinutes)} · {formatDistance(route.distanceMetres)}
        </p>
      </div>
      <SensoryBadge rating={route.sensoryRating} />
    </div>
  );
}
