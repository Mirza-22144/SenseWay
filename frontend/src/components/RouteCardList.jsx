import RouteCard from "./RouteCard";

export default function RouteCardList({
  routes,
  recommendedRouteId,
  fastestRouteId,
  quieterAlternativeRouteId,
  selectedRouteId,
  onSelect,
  onShowDetails,
  onGetNavigation,
}) {
  if (!routes || routes.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {routes.map((route) => (
        <RouteCard
          key={route.routeId}
          route={route}
          recommendedRouteId={recommendedRouteId}
          fastestRouteId={fastestRouteId}
          quieterAlternativeRouteId={quieterAlternativeRouteId}
          isSelected={route.routeId === selectedRouteId}
          onSelect={onSelect}
          onShowDetails={onShowDetails}
          onGetNavigation={onGetNavigation}
        />
      ))}
    </div>
  );
}
