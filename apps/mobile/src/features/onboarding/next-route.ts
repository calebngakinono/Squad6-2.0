// The screen to open once onboarding finishes (Join or Start a squad). Onboarding sets it just before
// the navigator switches to the app; Home opens it once.
let pending: string | null = null;

export function setRouteAfterOnboarding(route: string | null) {
  pending = route;
}

export function takeRouteAfterOnboarding(): string | null {
  const route = pending;
  pending = null;
  return route;
}
