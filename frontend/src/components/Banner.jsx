const VARIANT_CLASSES = {
  info: "bg-sky-50 text-sky-800 border-sky-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  error: "bg-rose-50 text-rose-800 border-rose-200",
};

export default function Banner({ variant = "info", children }) {
  if (!children) return null;

  return (
    <div
      role="status"
      className={`rounded-lg border px-4 py-3 text-sm ${VARIANT_CLASSES[variant] || VARIANT_CLASSES.info}`}
    >
      {children}
    </div>
  );
}
