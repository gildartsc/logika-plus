import type { TaskType } from "./data";
import type { TopicStatus } from "./progress";

type StatsTask = {
  type: TaskType;
  status: "not_started" | "in_progress" | "solved";
  hints_used: number;
  ai_messages_count: number;
  completed_at: string | null;
};

type StatsTopic = {
  order_number: number;
  title: string;
  status: TopicStatus;
  tasks: StatsTask[];
};

export type HistoryEntry = { order: number; title: string; completedAt: string };

export type ProfileStats = {
  totalTopics: number;
  completedTopics: number;
  solvedByType: Record<TaskType, number>;
  hintsUsed: number;
  aiMessages: number;
  history: HistoryEntry[];
};

export const HISTORY_LIMIT = 10;

// A topic is completed when its last task is solved, so its date is the
// latest completed_at among its tasks.
function topicCompletedAt(topic: StatsTopic): string | null {
  const dates = topic.tasks.map((task) => task.completed_at).filter((d): d is string => d !== null);
  if (dates.length === 0) return null;
  return dates.reduce((latest, d) => (Date.parse(d) > Date.parse(latest) ? d : latest));
}

export function computeProfileStats(topics: StatsTopic[]): ProfileStats {
  const tasks = topics.flatMap((topic) => topic.tasks);
  const solved = tasks.filter((task) => task.status === "solved");

  const history = topics
    .filter((topic) => topic.status === "completed")
    .map((topic) => ({ order: topic.order_number, title: topic.title, completedAt: topicCompletedAt(topic) }))
    .filter((entry): entry is HistoryEntry => entry.completedAt !== null)
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))
    .slice(0, HISTORY_LIMIT);

  return {
    totalTopics: topics.length,
    completedTopics: topics.filter((topic) => topic.status === "completed").length,
    solvedByType: {
      critical: solved.filter((task) => task.type === "critical").length,
      engineering: solved.filter((task) => task.type === "engineering").length,
    },
    hintsUsed: tasks.reduce((sum, task) => sum + task.hints_used, 0),
    aiMessages: tasks.reduce((sum, task) => sum + task.ai_messages_count, 0),
    history,
  };
}
