import { useEffect } from "react";
import { formatDistance, formatDuration } from "../utils/format";

// "Get Navigation": ordered turn-by-turn walking directions for the
// currently-selected route. steps[] comes straight from the backend (real
// Google Routes API data in live mode, fixed fixtures in mock mode) — never
// fabricated here.
export default function TurnByTurnModal({ route, onClose }) {
  useEffect(() => {
    if (!route) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [route, onClose]);

  if (!route) return null;

  const steps = route.steps || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Turn-by-turn directions"
        className="flex w-full max-w-lg max-h-[80vh] flex-col gap-5 rounded-xl border border-line bg-base p-8 shadow-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-primary">Directions: {route.summary}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="cursor-pointer text-sm font-medium text-muted">
            ✕
          </button>
        </div>

        {steps.length === 0 ? (
          <p className="text-sm text-secondary">Turn-by-turn directions aren&apos;t available for this route.</p>
        ) : (
          <ol className="flex flex-col gap-4 overflow-y-auto">
            {steps.map((step, index) => (
              <li key={index} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-brand-ink">
                  {index + 1}
                </span>
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm text-primary">{step.instruction || "Continue"}</p>
                  {(step.distanceMetres > 0 || step.durationMinutes > 0) && (
                    <p className="text-xs text-muted">
                      {formatDistance(step.distanceMetres)} · {formatDuration(step.durationMinutes)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}

        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-lg bg-brand py-3 text-sm font-semibold text-inverse hover:brightness-95"
        >
          Close
        </button>
      </div>
    </div>
  );
}
