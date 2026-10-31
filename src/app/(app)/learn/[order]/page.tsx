import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Markdown } from "@/components/learn/Markdown";
import { TopicWorkspace } from "@/components/learn/TopicWorkspace";
import { PageFallback } from "@/components/PageFallback";
import { AI_LIMITS } from "@/config/ai";
import { isAiAvailable } from "@/lib/learn/ai-store";
import { getChatHistory, getCourse, getMyFiles, getOpenedHints } from "@/lib/learn/data";
import { pickLandingTopic } from "@/lib/learn/progress";

export const metadata: Metadata = { title: "Обучение" };

// params and the session are request data, so both are read inside <Suspense>.
export default function TopicPage({ params }: PageProps<"/learn/[order]">) {
  return (
    <Suspense fallback={<PageFallback text="Загружаем тему…" />}>
      <TopicContent params={params} />
    </Suspense>
  );
}

function parseOrder(raw: string): number | null {
  if (!/^\d{1,2}$/.test(raw)) return null;
  return Number(raw);
}

async function TopicContent({ params }: { params: PageProps<"/learn/[order]">["params"] }) {
  const order = parseOrder((await params).order);
  if (order === null) notFound();

  const { topics, statuses } = await getCourse();
  const topic = topics.find((t) => t.order_number === order);
  if (!topic) notFound();
  if (topic.status === "locked") {
    const landing = pickLandingTopic(topics, statuses);
    redirect(landing ? `/learn/${landing.order_number}` : "/learn");
  }

  const taskIds = topic.tasks.map((task) => task.id);
  const [hints, chats, files, aiAvailable] = await Promise.all([
    getOpenedHints(topic.tasks),
    getChatHistory(taskIds),
    getMyFiles(taskIds),
    isAiAvailable(),
  ]);

  return (
    <TopicWorkspace
      topic={{ order: topic.order_number, title: topic.title, description: topic.description }}
      menu={topics.map((t) => ({ order: t.order_number, title: t.title, status: t.status }))}
      aiAvailable={aiAvailable}
      tasks={topic.tasks.map((task) => ({
        id: task.id,
        type: task.type,
        status: task.status,
        content: <Markdown>{task.public_text}</Markdown>,
        hints: hints.get(task.id) ?? [],
        chat: chats.get(task.id) ?? [],
        remainingMessages: Math.max(AI_LIMITS.messagesPerTask - task.ai_messages_count, 0),
        files: files.get(task.id) ?? [],
      }))}
    />
  );
}
