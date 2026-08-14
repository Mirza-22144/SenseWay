import logoMark from "../assets/logo-mark.png";

const NAV_LINKS = [
  { key: "landing", label: "Home" },
  { key: "planner", label: "Route" },
  { key: "refuges", label: "Refuges" },
];

export default function NavBar({ currentView = "landing", onNavigate }) {
  return (
    <header className="flex h-20 items-center justify-between border-b border-line bg-base px-12">
      <button
        type="button"
        onClick={() => onNavigate?.("landing")}
        className="flex cursor-pointer items-center gap-2"
      >
        <img src={logoMark} alt="" className="size-8 rounded-lg object-contain" />
        <span className="text-xl font-semibold text-logo">SenseWay</span>
      </button>

      <nav className="flex items-center gap-10 text-lg font-medium">
        {NAV_LINKS.map((link) => {
          const isActive = link.key === currentView;
          return (
            <button
              key={link.key}
              type="button"
              onClick={() => onNavigate?.(link.key)}
              className={`cursor-pointer ${isActive ? "text-brand-ink" : "text-secondary"}`}
            >
              {link.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
