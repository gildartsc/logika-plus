import { z } from "zod";
import { isInviteCode, normalizeInviteCode } from "@/lib/invites/code";

export const NAME_MAX = 50;
export const CLASS_MAX = 10;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

const requiredString = z.string({ error: "Заполните поле" });

const email = requiredString
  .trim()
  .toLowerCase()
  .max(254, "Слишком длинный e-mail")
  .pipe(z.email("Введите корректный e-mail"));

export const loginSchema = z.object({
  email,
  password: requiredString.min(1, "Введите пароль").max(PASSWORD_MAX, "Слишком длинный пароль"),
});

export const INVITE_CODE_ERROR = "Код приглашения: 8 букв и цифр, например K7M2-QX9P";

export const registerSchema = z.object({
  inviteCode: requiredString
    .max(20, INVITE_CODE_ERROR)
    .transform(normalizeInviteCode)
    .refine(isInviteCode, INVITE_CODE_ERROR),
  name: requiredString
    .trim()
    .min(2, `Имя: от 2 до ${NAME_MAX} символов`)
    .max(NAME_MAX, `Имя: от 2 до ${NAME_MAX} символов`),
  className: requiredString
    .trim()
    .min(1, "Укажите класс")
    .max(CLASS_MAX, `Класс: не длиннее ${CLASS_MAX} символов`),
  email,
  password: requiredString
    .min(PASSWORD_MIN, `Пароль: не короче ${PASSWORD_MIN} символов`)
    .max(PASSWORD_MAX, `Пароль: не длиннее ${PASSWORD_MAX} символов`),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
