import { sensoryMeta } from "../utils/sensory";

// Colour-coded Low/Moderate/High/Unknown pill (AC 1.1.1). When `onClick` is
// given it doubles as the trigger for the sensory details modal (AC 1.1.2) —
// callers must stopPropagation so it doesn't also trigger route selection.
export default function SensoryBadge({ rating, onClick, label = "Sensory rating" }) {
  const meta = sensoryMeta(rating);
  const classes = `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${meta.badgeClass}`;

  const content = (
    <>
      <span className={`h-2 w-2 rounded-full ${meta.dotClass}`} aria-hidden="true" />
      {meta.label}
    </>
  );

  if (!onClick) {
    return <span className={classes}>{content}</span>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${classes} cursor-pointer hover:brightness-95`}
      aria-label={`${label}: ${meta.label}. View details.`}
    >
      {content}
    </button>
  );
}
