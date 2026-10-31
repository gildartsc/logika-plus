import { z } from "zod";

export const profileSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(["student", "admin"]),
  class: z.string(),
  total_points: z.number().int(),
  is_blocked: z.boolean(),
});

export type Profile = z.infer<typeof profileSchema>;
export type Role = Profile["role"];

export type AccessResult =
  | { status: "ok"; profile: Profile }
  | { status: "unauthenticated" }
  | { status: "no_profile" }
  | { status: "blocked" }
  | { status: "forbidden" };

export function checkAccess(
  userId: string | null,
  profile: Profile | null,
  requiredRole: Role,
): AccessResult {
  if (!userId) return { status: "unauthenticated" };
  if (!profile || profile.id !== userId) return { status: "no_profile" };
  if (profile.is_blocked) return { status: "blocked" };
  if (requiredRole === "admin" && profile.role !== "admin") {
    return { status: "forbidden" };
  }
  return { status: "ok", profile };
}
