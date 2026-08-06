import SensoryBadge from "./SensoryBadge";
import { formatDistance, formatDuration } from "../utils/format";

// AC 1.1.1 (colour-coded route options) + AC 1.1.3 (select an alternative
// route). The sensory badge is a separate click target for AC 1.1.2's details
// modal, so its click must not also select the route. The card itself can't be
// a <button> because it contains another real button, so it's a div with the
// button role instead.
export default function RouteCard({ route, isRecommended, isSelected, onSelect, onShowDetails }) {
  const dataUnavailable = route.dataState === "unavailable";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(route.routeId)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(route.routeId);
        }
      }}
      aria-pressed={isSelected}
      className={`w-full cursor-pointer rounded-xl border p-4 text-left transition ${
        isSelected
          ? "border-violet-400 bg-violet-50 ring-1 ring-violet-300"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          {isRecommended && (
            <span className="mb-1 inline-block rounded-full bg-violet-600 px-2 py-0.5 text-[11px] font-semibold text-white">
              Recommended
            </span>
          )}
          <p className="font-medium text-slate-900">{route.summary}</p>
          <p className="text-sm text-slate-500">
            {formatDuration(route.durationMinutes)} · {formatDistance(route.distanceMetres)}
            {route.minutesSlowerThanFastest > 0 && (
              <> · +{route.minutesSlowerThanFastest} min vs fastest</>
            )}
          </p>
        </div>

        {dataUnavailable ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onShowDetails(route);
            }}
            className="shrink-0 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
          >
            Sensory data unavailable
          </button>
        ) : (
          <span
            onClick={(event) => {
              event.stopPropagation();
            }}
            className="shrink-0"
          >
            <SensoryBadge rating={route.sensoryRating} onClick={() => onShowDetails(route)} />
          </span>
        )}
      </div>
    </div>
  );
}
