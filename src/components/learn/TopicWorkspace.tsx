"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChartIcon, CheckIcon, SearchIcon } from "@/components/icons";
import { AnswerForm } from "./AnswerForm";
import { HintPanel } from "./HintPanel";
import { MentorPanel } from "./MentorPanel";
import { MyFiles } from "./MyFiles";
import { TopicMenu } from "./TopicMenu";
import { TASK_TYPE_LABELS, type ChatMessage, type MenuTopic, type WorkspaceTask } from "./types";

type Props = {
  topic: { order: number; title: string; description: string };
  tasks: WorkspaceTask[];
  menu: MenuTopic[];
  aiAvailable: boolean;
};

export function TopicWorkspace({ topic, tasks, menu, aiAvailable }: Props) {
  const router = useRouter();
  const [activeId, setActiveId] = useState(tasks[0]?.id);
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>(() =>
    Object.fromEntries(tasks.map((task) => [task.id, task.chat])),
  );
  const [remaining, setRemaining] = useState<Record<string, number>>(() =>
    Object.fromEntries(tasks.map((task) => [task.id, task.remainingMessages])),
  );
  const activeTask = tasks.find((task) => task.id === activeId);

  function appendChat(taskId: string, ...messages: ChatMessage[]) {
    setChats((current) => ({ ...current, [taskId]: [...(current[taskId] ?? []), ...messages] }));
  }

  return (
    // pb-24 on phones: space below the content so the floating "Наставник"
    // button never covers the answer's "Отправить" button.
    <div className="grid gap-6 pb-24 lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-0">
      <div className="min-w-0">
        <TopicMenu topics={menu} activeOrder={topic.order} />
        <div className="mt-5 flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold-400 text-xl font-extrabold text-ink shadow-[0_3px_0_var(--color-gold-600)]">
            {topic.order}
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{topic.title}</h1>
            {topic.description && <p className="mt-1 text-stone-600">{topic.description}</p>}
          </div>
        </div>

        <div role="tablist" aria-label="Задачи темы" className="mt-6 grid grid-cols-2 gap-2 sm:gap-3">
          {tasks.map((task) => {
            const selected = task.id === activeId;
            const Icon = task.type === "critical" ? SearchIcon : ChartIcon;
            return (
              <button
                key={task.id}
                type="button"
                role="tab"
                id={`tab-${task.id}`}
                aria-selected={selected}
                aria-controls={`panel-${task.id}`}
                onClick={() => setActiveId(task.id)}
                className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-2.5 text-left text-sm font-semibold transition-colors sm:px-4 ${
                  selected
                    ? "border-brand-500 bg-brand-50 text-brand-800 shadow-[0_3px_0_var(--color-brand-500)]"
                    : "border-line bg-white text-stone-600 shadow-[0_3px_0_var(--color-line)] hover:text-ink"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="min-w-0 flex-1 leading-tight">{TASK_TYPE_LABELS[task.type]}</span>
                {task.status === "solved" && (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <CheckIcon className="h-4 w-4" title="решена" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Inactive panels stay mounted so a draft answer survives tab switches. */}
        {tasks.map((task) => (
          <section
            key={task.id}
            role="tabpanel"
            id={`panel-${task.id}`}
            aria-labelledby={`tab-${task.id}`}
            hidden={task.id !== activeId}
            className="card mt-5 p-5 sm:p-6"
          >
            {task.content}
            <HintPanel taskId={task.id} initialHints={task.hints} />
            <AnswerForm
              taskId={task.id}
              solved={task.status === "solved"}
              onGraded={(result, sentFiles) => {
                appendChat(task.id, { role: "ai", message: result.feedback });
                // Refresh statuses (tab check mark, topic menu) and the file list.
                if (result.status === "solved" || sentFiles > 0) router.refresh();
              }}
            />
            <MyFiles files={task.files} />
          </section>
        ))}

        {tasks.length === 0 && (
          <p className="mt-6 text-stone-600">Задачи для этой темы ещё не добавлены.</p>
        )}
      </div>

      {activeTask && (
        <MentorPanel
          taskId={activeTask.id}
          taskLabel={TASK_TYPE_LABELS[activeTask.type]}
          messages={chats[activeTask.id] ?? []}
          remaining={remaining[activeTask.id] ?? 0}
          aiAvailable={aiAvailable}
          onExchange={(taskId, sent, reply, left) => {
            appendChat(taskId, { role: "user", message: sent }, { role: "ai", message: reply });
            setRemaining((current) => ({ ...current, [taskId]: left }));
          }}
        />
      )}
    </div>
  );
}
