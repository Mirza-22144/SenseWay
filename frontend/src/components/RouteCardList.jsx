import RouteCard from "./RouteCard";

export default function RouteCardList({ routes, recommendedRouteId, selectedRouteId, onSelect, onShowDetails }) {
  if (!routes || routes.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {routes.map((route) => (
        <RouteCard
          key={route.routeId}
          route={route}
          isRecommended={route.routeId === recommendedRouteId}
          isSelected={route.routeId === selectedRouteId}
          onSelect={onSelect}
          onShowDetails={onShowDetails}
        />
      ))}
    </div>
  );
}
