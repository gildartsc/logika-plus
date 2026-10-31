import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { TaskForm, type TaskFormValues } from "@/components/admin/TaskForm";
import { TopicForm } from "@/components/admin/TopicForm";
import { PageFallback } from "@/components/PageFallback";
import { deleteTask, deleteTopic } from "@/lib/admin/actions";
import { listToLines } from "@/lib/admin/forms";
import { getTopicAdmin, type AdminTask } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Тема" };

export default function AdminTopicPage({ params }: PageProps<"/admin/topics/[id]">) {
  return (
    <section className="space-y-6">
      <Link href="/admin/topics" className="text-sm text-brand-600 hover:underline">
        ← Все темы
      </Link>
      <Suspense fallback={<PageFallback />}>
        <TopicEditor params={params} />
      </Suspense>
    </section>
  );
}

function toFormValues(task: AdminTask | null): TaskFormValues | null {
  if (!task) return null;
  return {
    public_text: task.public_text,
    ai_context: task.ai_context,
    grading_criteria: listToLines(task.grading_criteria),
    common_mistakes: listToLines(task.common_mistakes),
    hint_1: task.hint_1,
    hint_2: task.hint_2,
    hint_3: task.hint_3,
  };
}

const TYPES = [
  { type: "critical", title: "Критическое мышление" },
  { type: "engineering", title: "Инженерное мышление" },
] as const;

async function TopicEditor({ params }: { params: PageProps<"/admin/topics/[id]">["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { topic, tasks, hasStudentData, taskHasStudentData } = await getTopicAdmin(id);

  return (
    <>
      <h1 className="text-2xl font-bold text-ink">
        Тема {topic.order_number}. {topic.title}
      </h1>
      <div className="card p-5">
        <TopicForm topic={topic} />
      </div>

      {TYPES.map(({ type, title }) => {
        const task = tasks[type];
        return (
          <div key={type} className="card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-ink">
                {title}
                {!task && <span className="ml-2 text-sm font-normal text-red-600">задача не заполнена</span>}
              </h2>
              {task && !taskHasStudentData[task.id] && (
                <ConfirmButton
                  label="Удалить задачу"
                  confirmLabel="Да, удалить"
                  warning="Задача будет удалена. Учеников она ещё не затрагивала."
                  action={deleteTask.bind(null, task.id)}
                />
              )}
            </div>
            <TaskForm topicId={topic.id} type={type} values={toFormValues(task)} />
          </div>
        );
      })}

      <div className="card border-red-200 p-5">
        <h2 className="font-semibold text-ink">Удаление темы</h2>
        {hasStudentData ? (
          <p className="mt-2 text-sm text-stone-600">
            По задачам этой темы уже есть ответы, переписка или прогресс учеников, поэтому удалить её нельзя:
            эти данные нужны для исследования. Исправьте тему или задачи редактированием.
          </p>
        ) : (
          <div className="mt-2">
            <ConfirmButton
              label="Удалить тему"
              confirmLabel="Да, удалить тему и её задачи"
              warning="Тема и её задачи будут удалены. Данных учеников по ним нет."
              action={deleteTopic.bind(null, topic.id)}
            />
          </div>
        )}
      </div>
    </>
  );
}
