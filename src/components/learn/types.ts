import type { ReactNode } from "react";
import type { ChatMessage, MyFile, TaskStatus, TaskType } from "@/lib/learn/data";
import type { TopicStatus } from "@/lib/learn/progress";

export type MenuTopic = { order: number; title: string; status: TopicStatus };

export type WorkspaceTask = {
  id: string;
  type: TaskType;
  status: TaskStatus;
  content: ReactNode;
  hints: string[];
  chat: ChatMessage[];
  remainingMessages: number;
  files: MyFile[];
};

export type { ChatMessage, MyFile };

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  critical: "Критическое мышление",
  engineering: "Инженерное мышление",
};
