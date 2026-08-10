const VARIANT_CLASSES = {
  info: "bg-sky-50 text-sky-800 border-sky-200",
  warning: "bg-warning-subtle text-warning-ink border-warning",
  error: "bg-danger-subtle text-danger-ink border-danger",
  brand: "bg-brand-subtle text-secondary border-brand",
};

export default function Banner({ variant = "info", children }) {
  if (!children) return null;

  const classes = `rounded-lg border px-5 py-4 text-sm ${VARIANT_CLASSES[variant] || VARIANT_CLASSES.info}`;

  if (variant === "brand") {
    return (
      <div role="status" className={`flex items-start gap-4 ${classes}`}>
        <span className="mt-0.5 size-6 shrink-0 rounded-full bg-brand" aria-hidden="true" />
        <p className="text-xs">{children}</p>
      </div>
    );
  }

  return (
    <div role="status" className={classes}>
      {children}
    </div>
  );
}
