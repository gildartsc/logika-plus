const MESSAGES: Record<string, string> = {
  invalid_credentials: "Неверный e-mail или пароль",
  email_not_confirmed: "Подтвердите e-mail: ссылка пришла в письме",
  user_already_exists: "Пользователь с таким e-mail уже зарегистрирован",
  email_exists: "Пользователь с таким e-mail уже зарегистрирован",
  weak_password: "Пароль слишком простой, придумайте сложнее",
  email_address_invalid: "Этот e-mail не подходит, введите другой",
  over_email_send_rate_limit: "Слишком много писем. Попробуйте позже",
  over_request_rate_limit: "Слишком много попыток. Подождите немного",
  signup_disabled: "Регистрация сейчас закрыта",
};

export const GENERIC_AUTH_ERROR = "Что-то пошло не так. Попробуйте ещё раз";

export function authErrorMessage(code: string | undefined): string {
  return (code && MESSAGES[code]) || GENERIC_AUTH_ERROR;
}
