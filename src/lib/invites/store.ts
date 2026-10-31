import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Marks the code as used in one conditional update, so two registrations
// with the same code cannot both succeed. Returns false for an unknown or
// already used code.
export async function claimInvite(code: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("invite_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code", code)
    .is("used_at", null)
    .select("code");
  if (error) throw new Error(`Failed to claim invite: ${error.code}`);
  return (data ?? []).length === 1;
}

// Gives the code back when the account could not be created.
export async function releaseInvite(code: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("invite_codes")
    .update({ used_at: null })
    .eq("code", code)
    .is("used_by", null);
  if (error) console.error("Failed to release invite:", error.code);
}

export async function linkInviteToUser(code: string, userId: string): Promise<void> {
  const { error } = await createAdminClient().from("invite_codes").update({ used_by: userId }).eq("code", code);
  if (error) console.error("Failed to link invite:", error.code);
}
