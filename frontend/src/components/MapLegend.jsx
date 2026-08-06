import { SENSORY_META } from "../utils/sensory";

// AC 1.2.1: legend explaining the four segment-shading states. Anchored
// directly under the map rather than overlaid on the map canvas, so it never
// covers the drag/zoom controls.
export default function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-b-xl border border-t-0 border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
      {["Low", "Moderate", "High"].map((rating) => (
        <span key={rating} className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: SENSORY_META[rating].mapColor }}
            aria-hidden="true"
          />
          {rating}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span
          className="h-0 w-4 border-t-2 border-dashed"
          style={{ borderColor: SENSORY_META.Unknown.mapColor }}
          aria-hidden="true"
        />
        No live data
      </span>
    </div>
  );
}
