"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AI_LIMITS } from "@/config/ai";
import { sendMentorMessage } from "@/lib/learn/actions";
import { CheckIcon, CloseIcon, SendIcon } from "@/components/icons";
import { splitFeedback } from "@/lib/learn/chat-format";
import type { ChatMessage } from "./types";

type Props = {
  taskId: string;
  taskLabel: string;
  messages: ChatMessage[];
  remaining: number;
  aiAvailable: boolean;
  onExchange: (taskId: string, sent: string, reply: string, remaining: number) => void;
};

function MentorChat({ taskId, taskLabel, messages, remaining, aiAvailable, onExchange }: Props) {
  const [draft, setDraft] = useState("");
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pendingText]);

  const disabled = !aiAvailable || remaining <= 0;

  function send() {
    const text = draft.trim();
    if (!text || pending || disabled) return;
    setError(null);
    setPendingText(text);
    startTransition(async () => {
      const result = await sendMentorMessage(taskId, text);
      setPendingText(null);
      if (result.ok) {
        setDraft("");
        onExchange(taskId, text, result.reply, result.remaining);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3">
        <MentorAvatar />
        <div>
          <h2 className="font-extrabold text-ink">ИИ-наставник</h2>
          <p className="text-xs text-stone-500">{taskLabel}</p>
        </div>
      </div>

      <div className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1" aria-live="polite">
        {messages.length === 0 && !pendingText && (
          <p className="text-sm text-stone-600">
            Наставник не даёт готовых ответов, а задаёт вопросы, которые помогают рассуждать.
            Расскажи, как ты думаешь решать задачу.
          </p>
        )}
        {messages.map((m, index) => (
          <Bubble key={index} role={m.role} text={m.message} />
        ))}
        {pendingText && (
          <>
            <Bubble role="user" text={pendingText} faded />
            <p className="flex items-center gap-2 text-sm text-stone-500" role="status">
              <span aria-hidden className="flex gap-1">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="h-2 w-2 animate-bounce rounded-full bg-brand-400"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </span>
              Наставник думает…
            </p>
          </>
        )}
        <div ref={endRef} />
      </div>

      <div className="mt-3 border-t-2 border-line pt-3">
        {!aiAvailable ? (
          <p className="text-sm text-stone-600">Наставник временно недоступен. Попробуй позже.</p>
        ) : remaining <= 0 ? (
          <p className="text-sm text-stone-600">
            Лимит сообщений по этой задаче исчерпан. Попробуй довести решение сам или открой подсказки.
          </p>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <textarea
              aria-label="Сообщение наставнику"
              rows={3}
              maxLength={AI_LIMITS.messageMaxChars}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              placeholder="Напиши, что думаешь…"
              className="field resize-none"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-xs text-stone-500">
                {draft.length} / {AI_LIMITS.messageMaxChars} · осталось сообщений: {remaining}
              </span>
              <button
                type="submit"
                disabled={pending || draft.trim().length === 0}
                className="btn-primary px-3 py-2 text-sm"
              >
                <SendIcon className="h-4 w-4" />
                Отправить
              </button>
            </div>
          </form>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <p className="mt-2 text-xs text-stone-500">
          Не пиши в чат личные данные: фамилию, телефон, адрес.
        </p>
      </div>
    </div>
  );
}

function MentorAvatar({ small = false }: { small?: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-brand-500 font-extrabold text-white shadow-[0_2px_0_var(--color-brand-700)] ${
        small ? "h-7 w-7 text-[11px]" : "h-10 w-10 text-sm"
      }`}
    >
      ИИ
    </span>
  );
}

function Bubble({ role, text, faded = false }: { role: "user" | "ai"; text: string; faded?: boolean }) {
  const mine = role === "user";
  const feedback = mine ? null : splitFeedback(text);
  if (feedback?.isFeedback) {
    // Answer checks are not mentor replies and do not count as messages.
    return (
      <div className="rounded-2xl border-2 border-gold-300 bg-gold-100 px-3 py-2 text-sm text-ink">
        <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-gold-800 uppercase">
          <CheckIcon className="h-3.5 w-3.5" /> Проверка ответа
        </p>
        <p className="mt-1 whitespace-pre-line">{feedback.text}</p>
      </div>
    );
  }
  if (mine) {
    return (
      <div className="flex justify-end">
        <p
          className={`max-w-[85%] rounded-2xl rounded-br-md bg-brand-500 px-3 py-2 text-sm whitespace-pre-line text-white ${
            faded ? "opacity-60" : ""
          }`}
        >
          {text}
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-end gap-2">
      <MentorAvatar small />
      <p className="max-w-[85%] rounded-2xl rounded-bl-md border-2 border-line bg-white px-3 py-2 text-sm whitespace-pre-line text-ink">
        {text}
      </p>
    </div>
  );
}

// Always visible on wide screens; a slide-in panel on phones.
export function MentorPanel(props: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside className="card hidden p-5 lg:sticky lg:top-20 lg:flex lg:h-[calc(100dvh-7rem)] lg:flex-col">
        <MentorChat {...props} />
      </aside>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Открыть ИИ-наставника"
        className="fixed right-4 bottom-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-lg font-extrabold text-white shadow-[0_4px_0_var(--color-brand-700)] hover:bg-brand-400 active:translate-y-0.5 lg:hidden"
      >
        ИИ
      </button>

      {open && (
        <div className="fixed inset-0 z-30 lg:hidden" role="dialog" aria-modal="true" aria-label="ИИ-наставник">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l-2 border-line bg-paper p-5 shadow-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Закрыть"
              className="self-end rounded-lg p-1.5 text-stone-500 hover:bg-white"
            >
              <CloseIcon />
            </button>
            <MentorChat {...props} />
          </div>
        </div>
      )}
    </>
  );
}
