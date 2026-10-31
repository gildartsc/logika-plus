import { z } from "zod";
import { AI_LIMITS } from "@/config/ai";
import { FILE_LIMITS } from "@/config/files";
import { ANSWER_MAX_CHARS } from "@/config/limits";

export const taskIdSchema = z.uuid("Некорректная задача");

// Text is required even with files: the student explains the reasoning in
// words, and the database rejects an empty answer_text.
export const ANSWER_TEXT_REQUIRED = "Напиши в поле ответа, как ты рассуждал. Файл дополняет ответ, но не заменяет его";

export const answerSchema = z
  .object({
    taskId: taskIdSchema,
    answer: z
      .string({ error: "Напишите ответ" })
      .trim()
      .min(1, ANSWER_TEXT_REQUIRED)
      .max(ANSWER_MAX_CHARS, `Ответ не длиннее ${ANSWER_MAX_CHARS} символов`),
    uploadIds: z
      .array(z.uuid("Файл не найден"))
      .max(FILE_LIMITS.maxFiles, `Можно прикрепить не больше ${FILE_LIMITS.maxFiles} файлов`)
      .default([]),
  });

export const uploadRequestSchema = z.object({
  taskId: taskIdSchema,
  files: z
    .array(z.object({ name: z.string().min(1).max(500), size: z.number().int() }))
    .min(1, "Выберите файл")
    .max(FILE_LIMITS.maxFiles, `Можно прикрепить не больше ${FILE_LIMITS.maxFiles} файлов`),
});

export const chatMessageSchema = z.object({
  taskId: taskIdSchema,
  message: z
    .string({ error: "Напиши сообщение" })
    .trim()
    .min(1, "Напиши сообщение")
    .max(AI_LIMITS.messageMaxChars, `Сообщение не длиннее ${AI_LIMITS.messageMaxChars} символов`),
});
