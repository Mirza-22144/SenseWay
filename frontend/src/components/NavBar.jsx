const NAV_LINKS = ["Home", "Refuges", "Reports", "About"];

// Static top navigation matching the Figma Nav Bar component (node 18:96).
// No router is installed yet, so only "Home" is styled active; the rest are
// non-interactive placeholders for now.
export default function NavBar() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-line bg-base px-12">
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-logo" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2C7.58 2 4 5.58 4 10c0 5.25 8 12 8 12s8-6.75 8-12c0-4.42-3.58-8-8-8Zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"
              fill="white"
            />
          </svg>
        </div>
        <span className="text-xl font-semibold text-logo">SenseWay</span>
      </div>

      <nav className="flex items-center gap-8 text-sm font-medium">
        {NAV_LINKS.map((link) => (
          <span key={link} className={link === "Home" ? "text-brand-ink" : "text-secondary"}>
            {link}
          </span>
        ))}
      </nav>

      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-secondary">Preferences</span>
        <div className="size-9 rounded-full bg-brand-subtle" aria-hidden="true" />
      </div>
    </header>
  );
}
