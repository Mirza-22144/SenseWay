import { formatDistance, formatDuration } from "../utils/format";

// AC 1.2.2: congestion exposure summary. Matches the Figma left-column
// "Route Summary" card (node 28:986) — TOTAL DISTANCE / WALKING TIME /
// HIGH-CROWD AREA. Figma shows a bare distance value for the happy path; the
// AC's exception sentences are used verbatim when there's nothing to measure.
export default function CongestionSummary({ route }) {
  if (!route) return null;

  let highCrowdValue = formatDistance(route.highCrowdDistanceMetres);
  let highCrowdIsSentence = false;

  if (route.dataState === "unavailable") {
    highCrowdValue = "Live congestion data unavailable.";
    highCrowdIsSentence = true;
  } else if (!route.highCrowdDistanceMetres) {
    highCrowdValue = "No high-crowd areas on this route.";
    highCrowdIsSentence = true;
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-base p-5">
      <p className="text-xs font-medium text-muted">ROUTE SUMMARY</p>
      <div className="flex gap-5">
        <div className="flex flex-1 flex-col gap-1">
          <p className="text-xs font-medium text-muted">TOTAL DISTANCE</p>
          <p className="text-lg font-semibold text-primary">{formatDistance(route.distanceMetres)}</p>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <p className="text-xs font-medium text-muted">WALKING TIME</p>
          <p className="text-lg font-semibold text-primary">{formatDuration(route.durationMinutes)}</p>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <p className="text-xs font-medium text-muted">HIGH-CROWD AREA</p>
          <p className={highCrowdIsSentence ? "text-xs text-danger-ink" : "text-lg font-semibold text-danger-ink"}>
            {highCrowdValue}
          </p>
        </div>
      </div>
    </div>
  );
}
