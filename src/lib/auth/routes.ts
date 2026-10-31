// Optimistic redirects for proxy. Real access checks live in guards.ts.
const PROTECTED_PREFIXES = ["/learn", "/profile", "/about", "/contacts", "/admin", "/files"];
const GUEST_ONLY_PREFIXES = ["/login", "/register"];

export const HOME_AFTER_LOGIN = "/learn";
export const LOGIN_PATH = "/login";

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function getAuthRedirect(
  pathname: string,
  isAuthenticated: boolean,
): string | null {
  if (!isAuthenticated && PROTECTED_PREFIXES.some((p) => matchesPrefix(pathname, p))) {
    return LOGIN_PATH;
  }
  if (isAuthenticated && GUEST_ONLY_PREFIXES.some((p) => matchesPrefix(pathname, p))) {
    return HOME_AFTER_LOGIN;
  }
  return null;
}
