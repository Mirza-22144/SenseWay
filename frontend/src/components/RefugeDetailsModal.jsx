import { useEffect } from "react";
import { formatDistance, formatDuration } from "../utils/format";
import { refugeIcon, refugeTypeLabel, refugeHoursText } from "../utils/refuge";

// AC 2.1.2: refuge details panel. AC 2.1.3's "Get Directions" is triggered
// from here. `attributes` is [] whenever the backend can't justify a tag from
// the Landmarks data (see refuge.service.js deriveAttributes) — per the AC's
// own exception, we omit the facilities section entirely rather than show it
// empty. Get Directions is never disabled: the AC's "disable when the refuge
// is closed" rule needs real opening-hours data to evaluate, and
// openingHoursToday is always null today (no hours exist in the dataset) —
// this reads the real field once it's populated instead of guessing.
export default function RefugeDetailsModal({ refuge, onClose, onGetDirections }) {
  useEffect(() => {
    if (!refuge) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [refuge, onClose]);

  if (!refuge) return null;

  const attributes = refuge.attributes || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Refuge details"
        className="flex w-full max-w-lg flex-col gap-5 rounded-xl border border-line bg-base p-8 shadow-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{refugeIcon(refuge)}</span>
            <h2 className="text-xl font-semibold text-primary">{refuge.name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="cursor-pointer text-sm font-medium text-muted">
            ✕
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-full bg-brand-subtle px-2.5 py-1 text-xs font-medium text-brand-ink">
            {refugeTypeLabel(refuge)}
          </span>
          <p className="text-sm text-secondary">{refugeHoursText(refuge)}</p>
        </div>

        <div className="flex gap-6">
          <div className="flex flex-1 flex-col gap-1">
            <p className="text-xs font-medium text-muted">WALKING TIME</p>
            <p className="text-base font-semibold text-primary">{formatDuration(refuge.walkingMinutes)}</p>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <p className="text-xs font-medium text-muted">DISTANCE</p>
            <p className="text-base font-semibold text-primary">{formatDistance(refuge.distanceMetres)}</p>
          </div>
        </div>

        {attributes.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted">AVAILABLE FACILITIES</p>
            <div className="flex flex-wrap gap-2">
              {attributes.map((attribute) => (
                <span
                  key={attribute}
                  className="rounded-full border border-line bg-subtle px-2.5 py-1 text-xs font-medium text-secondary"
                >
                  {attribute}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-brand px-5 py-3 text-sm font-semibold text-brand-ink hover:bg-brand-subtle"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => onGetDirections(refuge)}
            className="cursor-pointer rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-inverse hover:brightness-95"
          >
            Get Directions
          </button>
        </div>
      </div>
    </div>
  );
}
