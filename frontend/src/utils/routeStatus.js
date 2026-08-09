// Shared route badge/status label, used by RouteCard and RouteSummary.
export function routeStatusLabel(route, { recommendedRouteId, fastestRouteId, quieterAlternativeRouteId }) {
  if (route.routeId === recommendedRouteId) return "Recommended";
  if (route.routeId === quieterAlternativeRouteId) return "Quieter Alternative";
  if (route.routeId === fastestRouteId) return "Fastest";
  return "Alternative";
}
