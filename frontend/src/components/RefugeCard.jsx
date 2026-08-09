import { formatDistance, formatDuration } from "../utils/format";
import { refugeIcon, refugeTypeLabel } from "../utils/refuge";

export default function RefugeCard({ refuge, isNearest, isSelected, onSelect, onViewDetails }) {
  const attributes = refuge.attributes || [];

  return (
    <div
      className={`flex w-full flex-col gap-5 rounded-xl border bg-base p-6 shadow-card ${
        isSelected ? "border-2 border-brand" : "border-line"
      }`}
    >
      <div className="flex flex-col gap-1.5">
        <span
          className={`inline-block w-fit rounded px-2 py-0.5 text-xs font-medium ${
            isNearest ? "bg-success text-inverse" : "bg-subtle text-secondary"
          }`}
        >
          {(isNearest ? "Recommended" : refugeTypeLabel(refuge)).toUpperCase()}
        </span>
        <p className="text-lg font-semibold text-primary">
          {refugeIcon(refuge)} {refuge.name}
        </p>
      </div>

      {attributes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attributes.map((attribute) => (
            <span key={attribute} className="rounded-full bg-brand-subtle px-3 py-1 text-xs font-medium text-brand-ink">
              {attribute}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-6">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted">DISTANCE</p>
          <p className="text-lg font-semibold text-primary">{formatDistance(refuge.distanceMetres)}</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted">WALK</p>
          <p className="text-lg font-semibold text-primary">{formatDuration(refuge.walkingMinutes)}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          onSelect(refuge.refugeId);
          onViewDetails(refuge);
        }}
        className="w-full cursor-pointer rounded-lg bg-brand py-3 text-sm font-semibold text-inverse hover:brightness-95"
      >
        View Details
      </button>
    </div>
  );
}
