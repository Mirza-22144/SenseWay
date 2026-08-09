import { sensoryMeta } from "../utils/sensory";

// variant="chip" (default): pill used on route cards. variant="text": bare
// colored text, used in the details modal header. When onClick is given,
// callers must stopPropagation so it doesn't also trigger route selection.
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
