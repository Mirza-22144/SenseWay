import { useEffect, useRef, useState } from "react";

// small "?" trigger that reveals contextual help/status messages in one card, instead of stacking separate banners
export default function InfoPopover({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    function handleEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (!items.length) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="What does this mean?"
        aria-expanded={open}
        className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-brand font-serif text-sm italic font-semibold text-brand-ink hover:bg-brand-subtle"
      >
        i
      </button>

      {open && (
        <div
          role="status"
          className="absolute left-0 top-8 z-10 w-72 rounded-lg border border-brand bg-base p-4 shadow-lg"
        >
          <ul className="flex flex-col gap-3">
            {items.map((text) => (
              <li key={text} className="flex items-start gap-3 text-xs text-secondary">
                <span className="mt-0.5 size-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
