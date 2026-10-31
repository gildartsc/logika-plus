import { describe, expect, it } from "vitest";
import { REDACTED, redactPersonalData } from "./redact";

describe("redactPersonalData", () => {
  it.each([
    "8-900-123-45-67",
    "+7 (900) 123-45-67",
    "+79001234567",
    "89001234567",
    "900 123 45 67",
  ])("masks the phone number %s", (phone) => {
    expect(redactPersonalData(`мой телефон ${phone}, звони`)).toBe(`мой телефон ${REDACTED}, звони`);
  });

  it("masks e-mail addresses", () => {
    expect(redactPersonalData("пиши на ivan.petrov@mail.ru.")).toBe(`пиши на ${REDACTED}.`);
  });

  it.each([
    "В банке 250 мл и 80 мг кофеина",
    "Посещения: 120, 95, 140, 60",
    "Годы 2023 2024 2025",
    "Было 20 аварий, стало 60, самокатов 500 и 2500",
    "Отношение 60/2500 = 0,024",
  ])("leaves ordinary numbers alone: %s", (text) => {
    expect(redactPersonalData(text)).toBe(text);
  });

  it("masks several items in one message", () => {
    expect(redactPersonalData("8 900 123 45 67 и a@b.ru")).toBe(`${REDACTED} и ${REDACTED}`);
  });
});
