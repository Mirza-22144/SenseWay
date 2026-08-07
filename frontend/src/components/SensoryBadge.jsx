import { sensoryMeta } from "../utils/sensory";

// Colour-coded Low/Moderate/High/Unknown chip (AC 1.1.1), matching the Figma
// "chip/{rating} sensory" component. When `onClick` is given it doubles as the
// trigger for the sensory details modal (AC 1.1.2) — callers must
// stopPropagation so it doesn't also trigger route selection.
//
// `variant="chip"` (default) renders the pill used on route cards.
// `variant="text"` renders bare colored text with no background, used in the
// sensory details modal header.
export default function SensoryBadge({ rating, onClick, showSuffix = false, variant = "chip", label = "Sensory rating" }) {
  const meta = sensoryMeta(rating);
  const text = showSuffix ? `${meta.label} sensory` : meta.label;

  if (variant === "text") {
    return <span className={`text-lg font-semibold ${meta.textClass}`}>{text}</span>;
  }

  const classes = `inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${meta.chipClass}`;

  if (!onClick) {
    return <span className={classes}>{text}</span>;
  }

  return (
    <button type="button" onClick={onClick} className={`${classes} cursor-pointer hover:brightness-95`} aria-label={`${label}: ${meta.label}. View details.`}>
      {text}
    </button>
  );
}
