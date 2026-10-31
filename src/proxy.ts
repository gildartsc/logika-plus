import { NextResponse, type NextRequest } from "next/server";
import { getAuthRedirect } from "@/lib/auth/routes";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { response, isAuthenticated } = await updateSession(request);
  const target = getAuthRedirect(request.nextUrl.pathname, isAuthenticated);
  if (!target) {
    return response;
  }

  const redirect = NextResponse.redirect(new URL(target, request.url));
  // Keep refreshed session cookies on the redirect response.
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
