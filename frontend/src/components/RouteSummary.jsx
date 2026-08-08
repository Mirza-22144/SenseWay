import { formatDistance, formatDuration, formatTimestamp } from "../utils/format";
import { routeStatusLabel } from "../utils/routeStatus";

// AC 1.1.3: refreshes when the user picks a different route card. Matches the
// Figma under-map "Route Summary" bar (node 71:1068).
export default function RouteSummary({ route, recommendedRouteId, fastestRouteId, quieterAlternativeRouteId }) {
  if (!route) return null;

  const status = routeStatusLabel(route, { recommendedRouteId, fastestRouteId, quieterAlternativeRouteId });

  const fields = [
    { label: "SELECTED ROUTE", value: status },
    { label: "WALKING TIME", value: formatDuration(route.durationMinutes) },
    { label: "DISTANCE", value: formatDistance(route.distanceMetres) },
    { label: "SENSORY LEVEL", value: route.sensoryRating },
    { label: "LAST UPDATED", value: formatTimestamp(route.dataUpdatedAt) },
  ];

  return (
    <div className="flex flex-wrap gap-10 rounded-xl border border-line bg-base p-8">
      {fields.map((field) => (
        <div key={field.label} className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted">{field.label}</p>
          <p className="text-lg font-semibold text-primary">{field.value}</p>
        </div>
      ))}
    </div>
  );
}
