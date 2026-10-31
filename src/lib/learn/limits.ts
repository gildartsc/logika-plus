import { AI_LIMITS } from "@/config/ai";

export type LimitCounts = {
  monthSpendUsd: number;
  requestsLastMinute: number;
  requestsToday: number;
  taskMessages: number;
};

export type LimitCheck = { ok: true } | { ok: false; reason: LimitReason; message: string };
export type LimitReason = "budget" | "minute" | "day" | "task";

export const LIMIT_MESSAGES: Record<LimitReason, string> = {
  budget: "Наставник временно недоступен. Попробуй позже или обратись к учителю",
  minute: "Слишком много запросов подряд. Подожди минуту и попробуй снова",
  day: `На сегодня лимит обращений к наставнику исчерпан (${AI_LIMITS.requestsPerDay}). Возвращайся завтра`,
  task: `По этой задаче лимит сообщений наставнику исчерпан (${AI_LIMITS.messagesPerTask}). Попробуй довести решение сам или открой подсказки`,
};

// Checked in order of severity. The per-task limit applies to chat only.
export function checkLimits(counts: LimitCounts, kind: "chat" | "grading"): LimitCheck {
  const fail = (reason: LimitReason): LimitCheck => ({ ok: false, reason, message: LIMIT_MESSAGES[reason] });
  if (counts.monthSpendUsd >= AI_LIMITS.monthlyBudgetUsd) return fail("budget");
  if (counts.requestsLastMinute >= AI_LIMITS.requestsPerMinute) return fail("minute");
  if (counts.requestsToday >= AI_LIMITS.requestsPerDay) return fail("day");
  if (kind === "chat" && counts.taskMessages >= AI_LIMITS.messagesPerTask) return fail("task");
  return { ok: true };
}

// Offset of the time zone from UTC at a given moment, in milliseconds.
function zoneOffsetMs(date: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function localDate(now: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

function zonedMidnight(year: number, month: number, day: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day);
  return new Date(guess - zoneOffsetMs(new Date(guess), timeZone));
}

export function startOfDay(now: Date, timeZone: string): Date {
  const { year, month, day } = localDate(now, timeZone);
  return zonedMidnight(year, month, day, timeZone);
}

export function startOfMonth(now: Date, timeZone: string): Date {
  const { year, month } = localDate(now, timeZone);
  return zonedMidnight(year, month, 1, timeZone);
}
