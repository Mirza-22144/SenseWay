import { SENSORY_META } from "../utils/sensory";

// AC 1.2.1: legend explaining the four segment-shading states. Styled as a
// floating card matching the Figma "Map Legend" component, anchored to the
// map's top-right corner by the parent (MapView).
export default function MapLegend() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-base p-5 shadow-panel">
      <p className="text-sm font-medium text-primary">Map key</p>
      {["Low", "Moderate", "High"].map((rating) => (
        <div key={rating} className="flex items-center gap-3">
          <span className={`h-1 w-6 rounded-full ${SENSORY_META[rating].dotClass}`} aria-hidden="true" />
          <span className="text-xs text-secondary">{rating}</span>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <span className="size-3 rounded-full bg-subtle border border-line" aria-hidden="true" />
        <span className="text-xs text-secondary">No live data</span>
      </div>
    </div>
  );
}
