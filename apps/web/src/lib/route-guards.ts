/**
 * These render without a Page: the overview explains the empty state, the rest
 * are where a seller connects one or manages the account.
 */
export const PAGE_FREE_ROUTES = ["/", "/pages", "/onboarding", "/billing", "/admin"] as const;

/**
 * Every other route is scoped to a Page, and its loader asks the API for that
 * Page's data. Without a Page those requests answer 400 and the route falls into
 * the error boundary, so the caller redirects instead of loading it.
 */
export function needsConnectedPage(pathname: string): boolean {
  if (PAGE_FREE_ROUTES.includes(pathname as (typeof PAGE_FREE_ROUTES)[number])) {
    return false;
  }

  return !PAGE_FREE_ROUTES.some((route) => route !== "/" && pathname.startsWith(`${route}/`));
}
