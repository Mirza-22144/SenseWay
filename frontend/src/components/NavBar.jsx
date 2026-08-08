import logoMark from "../assets/logo-mark.png";

const NAV_LINKS = [
  { key: "home", label: "Home" },
  { key: "refuges", label: "Refuges" },
  { key: "reports", label: "Reports" },
  { key: "about", label: "About" },
];

// Top navigation matching the Figma Nav Bar component (node 18:96). "Home"
// and "Refuges" switch the app-level view; the rest are non-interactive
// placeholders since there's no full router installed.
export default function NavBar({ currentView = "home", onNavigate }) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-line bg-base px-12">
      <button
        type="button"
        onClick={() => onNavigate?.("home")}
        className="flex cursor-pointer items-center gap-2"
      >
        <img src={logoMark} alt="" className="size-8 rounded-lg object-contain" />
        <span className="text-xl font-semibold text-logo">SenseWay</span>
      </button>

      <nav className="flex items-center gap-8 text-sm font-medium">
        {NAV_LINKS.map((link) => {
          const isActive = link.key === currentView;
          const isNavigable = link.key === "home" || link.key === "refuges";
          return (
            <button
              key={link.key}
              type="button"
              disabled={!isNavigable}
              onClick={() => onNavigate?.(link.key)}
              className={`${isNavigable ? "cursor-pointer" : "cursor-default"} ${
                isActive ? "text-brand-ink" : "text-secondary"
              }`}
            >
              {link.label}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-secondary">Preferences</span>
        <div className="size-9 rounded-full bg-brand-subtle" aria-hidden="true" />
      </div>
    </header>
  );
}
