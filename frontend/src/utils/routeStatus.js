// Shared "which badge/status does this route get" logic, used by RouteCard
// (the badge) and RouteSummary (the "SELECTED ROUTE" field), so the two never
// disagree about what a route currently is.
export function routeStatusLabel(route, { recommendedRouteId, fastestRouteId, quieterAlternativeRouteId }) {
  if (route.routeId === recommendedRouteId) return "Recommended";
  // AC 1.2.3: labelled distinctly from a plain alternative so the trade-off
  // (extra time / high-crowd distance avoided) reads as a deliberate choice.
  if (route.routeId === quieterAlternativeRouteId) return "Quieter Alternative";
  if (route.routeId === fastestRouteId) return "Fastest";
  return "Alternative";
}
