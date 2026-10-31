"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { claimInvite, linkInviteToUser, releaseInvite } from "@/lib/invites/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { authErrorMessage, GENERIC_AUTH_ERROR } from "./errors";
import { HOME_AFTER_LOGIN } from "./routes";
import { loginSchema, registerSchema } from "./validation";

export type AuthFormState = {
  error?: string;
  notice?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
  values?: Record<string, string>;
};

const BLOCKED_MESSAGE = "Аккаунт заблокирован. Обратитесь к учителю";
const INVITE_REJECTED = "Код приглашения не подходит или уже использован. Попросите у учителя новый";

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = { email: textValue(formData, "email") };
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return { error: authErrorMessage(error?.code), values };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("is_blocked")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile || profile.is_blocked) {
    await supabase.auth.signOut();
    return { error: BLOCKED_MESSAGE, values };
  }

  redirect(HOME_AFTER_LOGIN);
}

// Registration needs a single-use invite code from the teacher. Public
// sign-ups are turned off in Supabase, so the account is created here with
// the service role, and only after the code has been claimed.
export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = {
    inviteCode: textValue(formData, "inviteCode"),
    name: textValue(formData, "name"),
    className: textValue(formData, "className"),
    email: textValue(formData, "email"),
  };
  const parsed = registerSchema.safeParse({
    inviteCode: formData.get("inviteCode"),
    name: formData.get("name"),
    className: formData.get("className"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const { inviteCode, name, className, email, password } = parsed.data;
  try {
    if (!(await claimInvite(inviteCode))) {
      return { fieldErrors: { inviteCode: [INVITE_REJECTED] }, values };
    }
  } catch (error) {
    console.error("signUp invite check failed:", (error as Error).message);
    return { error: GENERIC_AUTH_ERROR, values };
  }

  // Role is never sent: the database trigger always creates a student.
  const { data, error } = await createAdminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, class: className },
  });
  if (error || !data.user) {
    await releaseInvite(inviteCode);
    return { error: authErrorMessage(error?.code), values };
  }
  await linkInviteToUser(inviteCode, data.user.id);

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    return { notice: "Регистрация прошла успешно. Войдите со своим e-mail и паролем" };
  }
  redirect(HOME_AFTER_LOGIN);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
