/**
 * Regles de navigation partagees entre la Sidebar (desktop) et la MobileNav
 * (bottom bar < md). Une seule source de verite pour :
 * - les pages publiques sans chrome de navigation
 * - la reecriture des liens en mode demo (visiteur non connecte)
 */

export const PUBLIC_PATHS = new Set<string>([
  "/",
  "/connexion",
  "/inscription",
  "/terms",
  "/privacy",
  "/legal",
]);

export function isNavHidden(pathname: string): boolean {
  return (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/u/")
  );
}

/**
 * Visiteur non connecte = mode demo : le dashboard pointe vers /demo, les
 * routes personnelles (import, reglages) vers l'inscription.
 */
export function resolveDemoHref(href: string, authed: boolean): string {
  if (authed) return href;
  if (href === "/dashboard") return "/demo";
  if (href === "/import" || href === "/settings") return "/inscription";
  return href;
}
