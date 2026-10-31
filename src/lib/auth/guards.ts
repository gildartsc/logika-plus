import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAccess, profileSchema, type Profile, type Role } from "./access";
import { LOGIN_PATH } from "./routes";

export const BLOCKED_PATH = "/blocked";

// Per-request: header, gate and page share one lookup.
const loadSession = cache(async () => {
  // Session checks compare token expiry with Date.now(), so they must never
  // run during a prerender (including the App Shell runtime prefetch).
  await connection();
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;
  if (!userId) return { userId: null, profile: null };

  const { data } = await supabase
    .from("users")
    .select("id, name, role, class, total_points, is_blocked")
    .eq("id", userId)
    .maybeSingle();
  const parsed = profileSchema.safeParse(data);
  return { userId, profile: parsed.success ? parsed.data : null };
});

async function requireRole(role: Role): Promise<Profile> {
  const { userId, profile } = await loadSession();
  const access = checkAccess(userId, profile, role);
  switch (access.status) {
    case "ok":
      return access.profile;
    case "unauthenticated":
      redirect(LOGIN_PATH);
    case "no_profile":
    case "blocked":
      redirect(BLOCKED_PATH);
    case "forbidden":
      redirect("/learn");
  }
}

export function requireUser(): Promise<Profile> {
  return requireRole("student");
}

export function requireAdmin(): Promise<Profile> {
  return requireRole("admin");
}
